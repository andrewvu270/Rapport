import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { placeReservation, reconcileSession, releaseReservation } from './minuteReservation';
import { createServiceClient } from '../../lib/supabase-server';

// **Feature: network-coach, Property 7: Second-level reservation and consumption reconciliation**
// **Validates: Requirements 4.4, 4.5, 5.4, 5.5**

describe('MinuteReservation Property Tests', () => {
  const supabase = createServiceClient();
  const testUserIds: string[] = [];
  const testSessionIds: string[] = [];

  // Helper to create a test user
  async function createTestUser(): Promise<string> {
    const email = `test-${Date.now()}-${Math.random()}@example.com`;
    const password = 'testpassword123';

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create test user: ${authError?.message}`);
    }

    const userId = authData.user.id;

    // Create users table entry
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        tier: 'free',
        voice_minutes_used: 0,
        video_minutes_used: 0,
        billing_period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
      });

    if (userError) {
      throw new Error(`Failed to create user record: ${userError.message}`);
    }

    testUserIds.push(userId);
    return userId;
  }

  // Helper to create a test context
  async function createTestContext(userId: string): Promise<string> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90); // 90 days from now

    const { data, error } = await supabase
      .from('contexts')
      .insert({
        user_id: userId,
        mode: 'professional_networking',
        event_type: 'test event',
        industry: 'test industry',
        user_role: 'test role',
        user_goal: 'test goal',
        raw_input: { test: 'data' },
        expires_at: expiresAt.toISOString()
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create test context: ${error?.message}`);
    }

    return data.id;
  }

  // Helper to create a test session
  async function createTestSession(userId: string, sessionType: 'voice' | 'video'): Promise<string> {
    const contextId = await createTestContext(userId);

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        context_id: contextId,
        session_type: sessionType,
        status: 'reserved',
        seconds_reserved: 0,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create test session: ${error?.message}`);
    }

    testSessionIds.push(data.id);
    return data.id;
  }

  // Cleanup after each test
  afterEach(async () => {
    // Delete test sessions
    if (testSessionIds.length > 0) {
      await supabase.from('sessions').delete().in('id', testSessionIds);
      testSessionIds.length = 0;
    }

    // Delete test users
    if (testUserIds.length > 0) {
      for (const userId of testUserIds) {
        await supabase.auth.admin.deleteUser(userId);
      }
      testUserIds.length = 0;
    }
  });

  it('Property 7: For any completed session with known durationSeconds, seconds_consumed equals durationSeconds, minutes_consumed equals ceil(durationSeconds/60), and seconds_reserved is cleared', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          durationSeconds: fc.integer({ min: 1, max: 7200 }), // 1 second to 2 hours
          sessionType: fc.constantFrom('voice' as const, 'video' as const)
        }),
        async ({ durationSeconds, sessionType }) => {
          // Setup: create user and session
          const userId = await createTestUser();
          const sessionId = await createTestSession(userId, sessionType);

          // Get initial minute count
          const { data: initialUser } = await supabase
            .from('users')
            .select('voice_minutes_used, video_minutes_used')
            .eq('id', userId)
            .single();

          const initialMinutes = sessionType === 'voice' 
            ? initialUser?.voice_minutes_used || 0
            : initialUser?.video_minutes_used || 0;

          // Place reservation
          await placeReservation(sessionId, userId, sessionType);

          // Reconcile session with actual duration
          await reconcileSession(sessionId, durationSeconds);

          // Verify session state
          const { data: session } = await supabase
            .from('sessions')
            .select('seconds_consumed, seconds_reserved, status')
            .eq('id', sessionId)
            .single();

          // Property assertions
          expect(session?.seconds_consumed).toBe(durationSeconds);
          expect(session?.seconds_reserved).toBe(0);
          expect(session?.status).toBe('completed');

          // Verify user minutes updated correctly
          const { data: updatedUser } = await supabase
            .from('users')
            .select('voice_minutes_used, video_minutes_used')
            .eq('id', userId)
            .single();

          const expectedMinutesConsumed = Math.ceil(durationSeconds / 60);
          const actualMinutes = sessionType === 'voice'
            ? updatedUser?.voice_minutes_used || 0
            : updatedUser?.video_minutes_used || 0;

          expect(actualMinutes).toBe(initialMinutes + expectedMinutesConsumed);
        }
      ),
      { numRuns: 10 } // Reduced from 100 for integration test performance
    );
  }, 60000); // 60 second timeout for integration test

  it('Property 7 (interruption case): For any interrupted session, seconds_consumed equals elapsedSeconds and seconds_reserved is cleared', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          elapsedSeconds: fc.integer({ min: 1, max: 3600 }), // 1 second to 1 hour
          sessionType: fc.constantFrom('voice' as const, 'video' as const)
        }),
        async ({ elapsedSeconds, sessionType }) => {
          // Setup: create user and session
          const userId = await createTestUser();
          const sessionId = await createTestSession(userId, sessionType);

          // Place reservation
          await placeReservation(sessionId, userId, sessionType);

          // Release reservation due to interruption
          await releaseReservation(sessionId, elapsedSeconds);

          // Verify session state
          const { data: session } = await supabase
            .from('sessions')
            .select('seconds_consumed, seconds_reserved, status')
            .eq('id', sessionId)
            .single();

          // Property assertions
          expect(session?.seconds_consumed).toBe(elapsedSeconds);
          expect(session?.seconds_reserved).toBe(0);
          expect(session?.status).toBe('interrupted');
        }
      ),
      { numRuns: 10 } // Reduced from 100 for integration test performance
    );
  }, 60000); // 60 second timeout for integration test
});
