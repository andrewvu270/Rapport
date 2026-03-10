// Context input submitted by user
export interface ContextInput {
  eventType: string;
  industry: string;
  userRole: string;
  userGoal: string;
  targetPeopleDescription: string;
  urls?: string[];
  screenshotStoragePaths?: string[];
  plainTextNotes?: string;
}

// Talking Points Card — event-level only (key lessons / reminders)
export interface TalkingPointsCard {
  lessons: string[];           // exactly 3 items
  generatedAt: string;         // ISO timestamp
  degradedMode: boolean;
}

// Person Card
export interface PersonCard {
  participantName: string;
  profileSummary: string;
  icebreakers: string[];       // exactly 3, intel-grounded
  openers: string[];           // 3-5 conversation starters specific to this person
  followUpQuestions: string[]; // 3-5 follow-ups specific to this person
  topicsOfInterest: string[];
  thingsToAvoid: string[];
  suggestedAsk: string;
  replicaGender: 'male' | 'female';  // inferred from name/profile for Tavus replica selection
  limitedResearch: boolean;
  generatedAt: string;
}

// Transcript turn
export interface TranscriptTurn {
  speaker: 'user' | 'persona';
  text: string;
  timestamp: string;           // ISO timestamp
}

// Full transcript
export interface Transcript {
  turns: TranscriptTurn[];
  durationSeconds: number;  // authoritative time unit throughout; minutes derived as ceil(durationSeconds / 60)
  sessionId: string;
}

// Debrief moment (a specific improvable moment)
export interface DebriefMoment {
  turnIndex: number;
  userText: string;
  suggestion: string;
}

// Debrief scores
export interface DebriefScores {
  openers: number;          // 1-10
  questionQuality: number;  // 1-10
  responseRelevance: number;// 1-10
  closing: number;          // 1-10
}

// Full debrief report
export interface DebriefReport {
  sessionId: string;
  scores: DebriefScores;
  moments: DebriefMoment[];  // up to 3
  homework: string[];        // exactly 3
  generatedAt: string;
}

// MinuteReservation — transient type used during the reservation transaction, not a persisted model.
// The reservation lives on the sessions row (seconds_reserved field).
export interface MinuteReservation {
  sessionId: string;
  userId: string;
  sessionType: 'voice' | 'video';
  secondsReserved: number;  // stored as seconds; displayed/billed as ceil(secondsReserved / 60) minutes
  reservedAt: string;
}

// Extracted entities from intel gathering
export interface ExtractedParticipant {
  name: string;
  role?: string;
  company?: string;
  topics: string[];
}

export interface ExtractedEntities {
  participants: ExtractedParticipant[];
  companies: string[];
  topics: string[];
}
