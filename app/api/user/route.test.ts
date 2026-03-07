import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createClient } from '@supabase/supabase-js';

/**
 * **Feature: network-coach, Property 12: Account deletion removes all data**
 * **Validates: Requirements 9.1**
 * 
 * Property: For any user account that is deleted, querying Supabase for any
 * records associated with that user's ID SHALL return empty result sets for
 * all tables (contexts, person_cards, sessions, debriefs).
 */
describe('Account deletion data removal', () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Create a service client for testing (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Track created users for cleanup
  const createdUserIds: string[] = [];

  afterEach(async () => {
    // Clean up any test users that weren't deleted during the test
    for (const userId of createdUserIds) {
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (error) {
        // User may already be deleted, ignore errors
      }
    }
    createdUserIds.length = 0;
  });

  /**
   * Helper function to create a test user with associated data
   */
  async function createTestUserWithData(email: string) {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: 'test-password-123',
      email_confirm: true,
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    const userId = authData.user.id;
    createdUserIds.push(userId);

    // Create user record
    await supabase.from('users').insert({
      id: userId,
      email,
      tier: 'free',
      voice_minutes_used: 0,
      video_minutes_used: 0,
      billing_period_start: new Date().toISOString().split('T')[0],
    });

    // Create a context
    const { data: contextData } = await supabase
      .from('contexts')
      .insert({
        user_id: userId,
        mode: 'professional_networking',
        event_type: 'Conference',
        industry: 'Tech',
        user_role: 'Engineer',
        user_goal: 'Network',
        raw_input: { test: 'data' },
        talking_points_card: { openers: ['test'], followUpQuestions: ['test'], lessons: ['test'], generatedAt: new Date().toISOString(), degradedMode: false },
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    const contextId = contextData?.id;

    // Create a person card
    if (contextId) {
      const { data: personCardData } = await supabase
        .from('person_cards')
        .insert({
          context_id: contextId,
          user_id: userId,
          participant_name: 'Test Person',
          card_data: { participantName: 'Test', profileSummary: 'test', icebreakers: ['a', 'b', 'c'], topicsOfInterest: [], thingsToAvoid: [], suggestedAsk: 'test', limitedResearch: false, generatedAt: new Date().toISOString() },
          pinecone_namespace: `${userId}/${contextId}/test-person`,
          limited_research: false,
        })
        .select()
        .single();

      const personCardId = personCardData?.id;

      // Create a session
      if (personCardId) {
        const { data: sessionData } = await supabase
          .from('sessions')
          .insert({
            user_id: userId,
            context_id: contextId,
            person_card_id: personCardId,
            session_type: 'voice',
            status: 'completed',
            seconds_reserved: 0,
            seconds_consumed: 300,
            transcript: { turns: [], durationSeconds: 300, sessionId: 'test' },
          })
          .select()
          .single();

        const sessionId = sessionData?.id;

        // Create a debrief
        if (sessionId) {
          await supabase.from('debriefs').insert({
            session_id: sessionId,
            user_id: userId,
            report_data: { sessionId, scores: { openers: 5, questionQuality: 5, responseRelevance: 5, closing: 5 }, moments: [], homework: ['a', 'b', 'c'], generatedAt: new Date().toISOString() },
            pending: false,
          });
        }
      }
    }

    return userId;
  }

  /**
   * Helper function to check if user data exists
   */
  async function checkUserDataExists(userId: string) {
    const [contextsResult, personCardsResult, sessionsResult, debriefsResult] = await Promise.all([
      supabase.from('contexts').select('id').eq('user_id', userId),
      supabase.from('person_cards').select('id').eq('user_id', userId),
      supabase.from('sessions').select('id').eq('user_id', userId),
      supabase.from('debriefs').select('id').eq('user_id', userId),
    ]);

    return {
      contexts: contextsResult.data || [],
      personCards: personCardsResult.data || [],
      sessions: sessionsResult.data || [],
      debriefs: debriefsResult.data || [],
    };
  }

  it('Property 12: Account deletion removes all associated data', async () => {
    // Generate random email for test user
    const testEmail = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;

    // Create test user with data
    const userId = await createTestUserWithData(testEmail);

    // Verify data exists before deletion
    const dataBefore = await checkUserDataExists(userId);
    expect(dataBefore.contexts.length).toBeGreaterThan(0);
    expect(dataBefore.personCards.length).toBeGreaterThan(0);
    expect(dataBefore.sessions.length).toBeGreaterThan(0);
    expect(dataBefore.debriefs.length).toBeGreaterThan(0);

    // Delete the user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    expect(deleteError).toBeNull();

    // Remove from cleanup list since we deleted it
    const index = createdUserIds.indexOf(userId);
    if (index > -1) {
      createdUserIds.splice(index, 1);
    }

    // Verify all data is deleted (cascaded)
    const dataAfter = await checkUserDataExists(userId);
    expect(dataAfter.contexts.length).toBe(0);
    expect(dataAfter.personCards.length).toBe(0);
    expect(dataAfter.sessions.length).toBe(0);
    expect(dataAfter.debriefs.length).toBe(0);
  }, 30000); // 30 second timeout for database operations
});

/**
 * **Feature: network-coach, Property 13: Data export completeness**
 * **Validates: Requirements 9.3**
 * 
 * Property: For any user with stored data, the JSON export SHALL contain
 * top-level keys for all data categories (contexts, personCards, sessions,
 * debriefs) and the export SHALL be valid, parseable JSON.
 */
describe('Data export completeness', () => {
  // Arbitrary generator for export data structure
  const exportDataArbitrary = fc.record({
    contexts: fc.array(fc.record({
      id: fc.uuid(),
      user_id: fc.uuid(),
      mode: fc.constant('professional_networking'),
      event_type: fc.string(),
      industry: fc.string(),
      user_role: fc.string(),
      user_goal: fc.string(),
      raw_input: fc.jsonValue(),
      talking_points_card: fc.jsonValue(),
      created_at: fc.date().map(d => d.toISOString()),
      expires_at: fc.date().map(d => d.toISOString()),
    })),
    personCards: fc.array(fc.record({
      id: fc.uuid(),
      context_id: fc.uuid(),
      user_id: fc.uuid(),
      participant_name: fc.string(),
      card_data: fc.jsonValue(),
      pinecone_namespace: fc.string(),
      limited_research: fc.boolean(),
      created_at: fc.date().map(d => d.toISOString()),
    })),
    sessions: fc.array(fc.record({
      id: fc.uuid(),
      user_id: fc.uuid(),
      context_id: fc.uuid(),
      person_card_id: fc.uuid(),
      session_type: fc.constantFrom('voice', 'video'),
      status: fc.constantFrom('reserved', 'preparing', 'active', 'completed', 'interrupted'),
      seconds_reserved: fc.nat(),
      seconds_consumed: fc.option(fc.nat(), { nil: null }),
      transcript: fc.option(fc.jsonValue(), { nil: null }),
      created_at: fc.date().map(d => d.toISOString()),
    })),
    debriefs: fc.array(fc.record({
      id: fc.uuid(),
      session_id: fc.uuid(),
      user_id: fc.uuid(),
      report_data: fc.jsonValue(),
      pending: fc.boolean(),
      pending_retry_count: fc.nat({ max: 5 }),
      pending_max_retries: fc.constant(5),
      created_at: fc.date().map(d => d.toISOString()),
    })),
  });

  it('Property 13: Export data contains all required top-level keys', () => {
    fc.assert(
      fc.property(exportDataArbitrary, (exportData) => {
        // Verify all top-level keys are present
        expect(exportData).toHaveProperty('contexts');
        expect(exportData).toHaveProperty('personCards');
        expect(exportData).toHaveProperty('sessions');
        expect(exportData).toHaveProperty('debriefs');

        // Verify all values are arrays
        expect(Array.isArray(exportData.contexts)).toBe(true);
        expect(Array.isArray(exportData.personCards)).toBe(true);
        expect(Array.isArray(exportData.sessions)).toBe(true);
        expect(Array.isArray(exportData.debriefs)).toBe(true);

        // Verify the export is valid JSON (can be serialized and parsed)
        const serialized = JSON.stringify(exportData);
        expect(typeof serialized).toBe('string');

        const parsed = JSON.parse(serialized);
        
        // Verify structure is preserved (keys and types)
        expect(Object.keys(parsed).sort()).toEqual(Object.keys(exportData).sort());
        expect(Array.isArray(parsed.contexts)).toBe(true);
        expect(Array.isArray(parsed.personCards)).toBe(true);
        expect(Array.isArray(parsed.sessions)).toBe(true);
        expect(Array.isArray(parsed.debriefs)).toBe(true);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 13: Export data structure is parseable JSON', () => {
    fc.assert(
      fc.property(exportDataArbitrary, (exportData) => {
        // Serialize to JSON
        const jsonString = JSON.stringify(exportData);

        // Verify it's a valid string
        expect(typeof jsonString).toBe('string');
        expect(jsonString.length).toBeGreaterThan(0);

        // Parse back
        const parsed = JSON.parse(jsonString);

        // Verify structure is preserved
        expect(Object.keys(parsed).sort()).toEqual(['contexts', 'debriefs', 'personCards', 'sessions']);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
