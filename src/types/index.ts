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

// Talking Points Card
export interface TalkingPointsCard {
  openers: string[];           // 3-5 items
  followUpQuestions: string[]; // 3-5 items
  lessons: string[];           // exactly 3 items
  generatedAt: string;         // ISO timestamp
  degradedMode: boolean;
}

// Person Card
export interface PersonCard {
  participantName: string;
  profileSummary: string;
  icebreakers: string[];       // exactly 3, intel-grounded
  topicsOfInterest: string[];
  thingsToAvoid: string[];
  suggestedAsk: string;
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
