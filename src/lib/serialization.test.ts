import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { serialize, deserialize } from './serialization';
import type { TalkingPointsCard, PersonCard, DebriefReport } from '@/src/types';

/**
 * **Feature: network-coach, Property 3: Serialization round-trip for prep documents**
 * **Validates: Requirements 3.5, 9 (Serialization Standard)**
 * 
 * Property: For any TalkingPointsCard or PersonCard object,
 * deserialize(serialize(x)) SHALL produce an object that is structurally
 * equivalent to x — same keys, same values, same types.
 */
describe('Prep document serialization round-trip', () => {
  // Arbitrary generator for TalkingPointsCard
  const talkingPointsCardArbitrary = fc.record({
    openers: fc.array(fc.string(), { minLength: 3, maxLength: 5 }),
    followUpQuestions: fc.array(fc.string(), { minLength: 3, maxLength: 5 }),
    lessons: fc.array(fc.string(), { minLength: 3, maxLength: 3 }),
    generatedAt: fc.date().map(d => d.toISOString()),
    degradedMode: fc.boolean(),
  });

  // Arbitrary generator for PersonCard
  const personCardArbitrary = fc.record({
    participantName: fc.string({ minLength: 1 }),
    profileSummary: fc.string(),
    icebreakers: fc.array(fc.string(), { minLength: 3, maxLength: 3 }),
    topicsOfInterest: fc.array(fc.string()),
    thingsToAvoid: fc.array(fc.string()),
    suggestedAsk: fc.string(),
    limitedResearch: fc.boolean(),
    generatedAt: fc.date().map(d => d.toISOString()),
  });

  it('Property 3: TalkingPointsCard serialization round-trip preserves structure', () => {
    fc.assert(
      fc.property(talkingPointsCardArbitrary, (card) => {
        const serialized = serialize<TalkingPointsCard>(card);
        const deserialized = deserialize<TalkingPointsCard>(serialized);

        // Verify structural equivalence
        expect(deserialized).toEqual(card);
        
        // Verify all keys are present
        expect(Object.keys(deserialized).sort()).toEqual(Object.keys(card).sort());
        
        // Verify array lengths
        expect(deserialized.openers.length).toBe(card.openers.length);
        expect(deserialized.followUpQuestions.length).toBe(card.followUpQuestions.length);
        expect(deserialized.lessons.length).toBe(card.lessons.length);
        
        // Verify types
        expect(typeof deserialized.generatedAt).toBe('string');
        expect(typeof deserialized.degradedMode).toBe('boolean');
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 3: PersonCard serialization round-trip preserves structure', () => {
    fc.assert(
      fc.property(personCardArbitrary, (card) => {
        const serialized = serialize<PersonCard>(card);
        const deserialized = deserialize<PersonCard>(serialized);

        // Verify structural equivalence
        expect(deserialized).toEqual(card);
        
        // Verify all keys are present
        expect(Object.keys(deserialized).sort()).toEqual(Object.keys(card).sort());
        
        // Verify array lengths
        expect(deserialized.icebreakers.length).toBe(card.icebreakers.length);
        expect(deserialized.topicsOfInterest.length).toBe(card.topicsOfInterest.length);
        expect(deserialized.thingsToAvoid.length).toBe(card.thingsToAvoid.length);
        
        // Verify types
        expect(typeof deserialized.participantName).toBe('string');
        expect(typeof deserialized.profileSummary).toBe('string');
        expect(typeof deserialized.suggestedAsk).toBe('string');
        expect(typeof deserialized.limitedResearch).toBe('boolean');
        expect(typeof deserialized.generatedAt).toBe('string');
        
        return true;
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: network-coach, Property 4: Serialization round-trip for debrief reports**
 * **Validates: Requirements 6.5, 9 (Serialization Standard)**
 * 
 * Property: For any DebriefReport object,
 * deserialize(serialize(x)) SHALL produce an object that is structurally
 * equivalent to x — same keys, same values, same types.
 */
describe('Debrief report serialization round-trip', () => {
  // Arbitrary generator for DebriefScores
  const debriefScoresArbitrary = fc.record({
    openers: fc.integer({ min: 1, max: 10 }),
    questionQuality: fc.integer({ min: 1, max: 10 }),
    responseRelevance: fc.integer({ min: 1, max: 10 }),
    closing: fc.integer({ min: 1, max: 10 }),
  });

  // Arbitrary generator for DebriefMoment
  const debriefMomentArbitrary = fc.record({
    turnIndex: fc.nat(),
    userText: fc.string(),
    suggestion: fc.string(),
  });

  // Arbitrary generator for DebriefReport
  const debriefReportArbitrary = fc.record({
    sessionId: fc.uuid(),
    scores: debriefScoresArbitrary,
    moments: fc.array(debriefMomentArbitrary, { maxLength: 3 }),
    homework: fc.array(fc.string(), { minLength: 3, maxLength: 3 }),
    generatedAt: fc.date().map(d => d.toISOString()),
  });

  it('Property 4: DebriefReport serialization round-trip preserves structure', () => {
    fc.assert(
      fc.property(debriefReportArbitrary, (report) => {
        const serialized = serialize<DebriefReport>(report);
        const deserialized = deserialize<DebriefReport>(serialized);

        // Verify structural equivalence
        expect(deserialized).toEqual(report);
        
        // Verify all keys are present
        expect(Object.keys(deserialized).sort()).toEqual(Object.keys(report).sort());
        
        // Verify scores structure
        expect(deserialized.scores.openers).toBe(report.scores.openers);
        expect(deserialized.scores.questionQuality).toBe(report.scores.questionQuality);
        expect(deserialized.scores.responseRelevance).toBe(report.scores.responseRelevance);
        expect(deserialized.scores.closing).toBe(report.scores.closing);
        
        // Verify array lengths
        expect(deserialized.moments.length).toBe(report.moments.length);
        expect(deserialized.homework.length).toBe(report.homework.length);
        
        // Verify types
        expect(typeof deserialized.sessionId).toBe('string');
        expect(typeof deserialized.generatedAt).toBe('string');
        expect(typeof deserialized.scores).toBe('object');
        expect(Array.isArray(deserialized.moments)).toBe(true);
        expect(Array.isArray(deserialized.homework)).toBe(true);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
