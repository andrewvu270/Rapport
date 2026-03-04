# Requirements Document

## Introduction

NetWork is an AI-powered conversation practice app that helps users prepare for and simulate professional networking events. The system operates in three phases: Intel Gathering (researching the event and target people), Practice Mode (voice or video roleplay with an AI persona), and Debrief (structured feedback and homework).

The MVP focuses exclusively on Professional Networking mode with full voice practice (Vapi) and video practice (Tavus) — no tier gating. The codebase is designed so that tier enforcement, additional modes (Socializing, Dating), and subscription billing (Stripe) can be added in a later phase without architectural changes. The Minute Reservation mechanism (Requirements 4 and 5) is intentional scaffolding — reservations are placed and reconciled in MVP but no limits are enforced yet; enforcement logic will be added when tiers are introduced.

A billing period is defined as a calendar month, resetting on the first day of each month.

## Glossary

- **NetWork**: The name of the application described in this document
- **Mode**: The conversation context — Professional Networking for MVP; Socializing and Dating reserved for future phases
- **Intel Gathering**: The phase where the system scrapes, searches, and aggregates information about an event and target people
- **Talking Points Card**: A pre-session prep document containing openers, follow-up questions, and lessons tailored to the user's context
- **Person Card**: A per-participant summary containing a plain-English profile, 3 tailored icebreakers, topics of interest, things to avoid, and a suggested ask
- **Practice Session**: An interactive roleplay conversation between the user and an AI Persona via voice or video
- **Persona**: A dynamically created AI character representing a specific person the user wants to practice networking with
- **Debrief**: The structured feedback report generated after a Practice Session, including scores, insights, and homework
- **Transcript**: The full text record of a completed Practice Session
- **RAG**: Retrieval-Augmented Generation — relevant documents are retrieved from a vector store and injected into an LLM prompt
- **Firecrawl**: A web scraping service used to extract structured content from URLs
- **Tavily**: An agentic web search API used to find live information about people and companies
- **Pinecone**: A vector database used to store and retrieve embedded intel documents
- **Supabase**: A Postgres-based backend used for user accounts, session history, and usage tracking
- **Vapi**: A voice AI platform used for real-time voice Practice Sessions
- **Tavus CVI**: A conversational video interface platform used for real-time video avatar Practice Sessions
- **Claude API**: The LLM used for talking points generation, persona prompting, and debrief analysis
- **OCR**: Optical Character Recognition — used to extract text from user-uploaded screenshots
- **Replica**: A visual avatar used in Tavus video sessions
- **Degraded Mode**: A fallback operating state where the system generates prep content using only user-provided inputs when external enrichment APIs are unavailable
- **PII**: Personally Identifiable Information — any data that can identify a real individual
- **Data Retention Period**: 90 days from the date of the associated session, or upon account deletion, whichever comes first
- **Serialization Standard**: All structured documents (Person Cards, Talking Points Cards, Debrief reports, Transcripts) SHALL be serialized to JSON before persistence and deserialized to a structurally equivalent object upon retrieval
- **Minute Reservation**: A transactional hold placed on a user's available session minutes at session start; converted to actual consumption at session end based on actual duration; released back if the session fails to start or is interrupted

## Requirements

### Requirement 1: Context Input

**User Story:** As a user preparing for a networking event, I want to provide event details and participant information, so that the system can generate personalized prep materials.

#### Acceptance Criteria

1. WHEN a user opens the app, THEN the NetWork system SHALL display a context input form with fields for event type, industry, user role, user goal, and target people description.
2. WHEN a user submits a URL as context input, THEN the NetWork system SHALL scrape the URL using Firecrawl and extract structured text including names, roles, topics, and descriptions.
3. WHEN a user uploads a screenshot as context input, THEN the NetWork system SHALL apply OCR to extract text from the image and treat the extracted text as structured context.
4. WHEN a user submits plain-text notes as context input, THEN the NetWork system SHALL parse the text and extract entities including names, roles, companies, and topics.
5. IF a submitted URL is inaccessible or returns no usable content, THEN the NetWork system SHALL notify the user with a specific error message and continue processing any remaining valid inputs.

---

### Requirement 2: Agentic Intel Enrichment

**User Story:** As a user, I want the system to automatically search for additional context beyond what I provide, so that my prep materials reflect current and relevant information.

#### Acceptance Criteria

1. WHEN context input is submitted, THEN the NetWork system SHALL run a Tavily agentic search for each identified participant and company to retrieve publicly available news and signals from the past 30 days.
2. WHEN agentic search results are retrieved, THEN the NetWork system SHALL embed the results using OpenAI embeddings and store them in Pinecone under a namespace scoped to the user, event, and participant.
3. WHEN generating prep content, THEN the NetWork system SHALL retrieve the top 5 most semantically relevant intel chunks from Pinecone for each participant.
4. WHILE intel gathering is in progress, THEN the NetWork system SHALL display a real-time status indicator showing which sources are being processed.
5. IF the Tavily API is unavailable, THEN the NetWork system SHALL enter Degraded Mode, generate prep content using only user-provided inputs, and notify the user that enrichment is unavailable.
6. IF the Pinecone service is unavailable, THEN the NetWork system SHALL enter Degraded Mode, generate prep content without RAG retrieval, and notify the user that personalized intel is unavailable.

---

### Requirement 3: Talking Points and Person Card Generation

**User Story:** As a user, I want a personalized Talking Points Card and per-person prep cards before my session, so that I know exactly what to say and ask.

#### Acceptance Criteria

1. WHEN context processing is complete, THEN the NetWork system SHALL generate a Talking Points Card containing 3 to 5 openers, 3 to 5 follow-up questions, and 3 lessons tailored to the user's context, and SHALL deliver it within 3 seconds for text-only inputs.
2. WHEN intel gathering is complete for a named participant, THEN the NetWork system SHALL generate a Person Card containing a plain-English profile summary, 3 tailored icebreakers, topics the person likely cares about, things to avoid, and a suggested ask.
3. WHEN generating icebreakers or openers, THEN the NetWork system SHALL base each one on specific retrieved intel such as a recent post, company news, or shared interest rather than generic openers.
4. IF no intel is retrievable for a participant, THEN the NetWork system SHALL generate a Person Card using only the user-provided information and label it as having limited research.
5. THE NetWork system SHALL persist all generated Talking Points Cards and Person Cards according to the Serialization Standard, linked to the user and session context in Supabase.

---

### Requirement 4: Voice Practice Mode

**User Story:** As a user, I want to practice a networking conversation with an AI voice persona, so that I can build confidence before the real event.

#### Acceptance Criteria

1. WHEN a user starts a voice Practice Session, THEN the NetWork system SHALL initiate a Vapi voice call with a system prompt that instructs the AI to roleplay as the selected Persona using the retrieved intel and Talking Points context.
2. WHEN the Vapi session is active, THEN the NetWork system SHALL inject the top retrieved intel chunks from Pinecone into the Vapi system prompt before the session begins.
3. WHEN the Vapi session ends normally, THEN the NetWork system SHALL save the full session Transcript to Supabase linked to the user, context, and Persona.
4. WHEN a user starts a voice session, THEN the NetWork system SHALL place a Minute Reservation on the user's account in a single atomic database transaction before initiating the Vapi call.
5. WHEN a voice session ends, THEN the NetWork system SHALL convert the Minute Reservation to actual consumption based on the session's actual duration in minutes, and release any unused reserved minutes back to the user's allowance.
6. IF the Vapi connection drops during an active session, THEN the NetWork system SHALL save any Transcript content collected up to that point, release the unused reserved minutes back to the user's allowance, and display a session interruption message.

---

### Requirement 5: Video Practice Mode

**User Story:** As a user, I want to practice with a realistic video avatar persona, so that I can simulate a face-to-face networking conversation.

#### Acceptance Criteria

1. WHEN a user starts a video Practice Session, THEN the NetWork system SHALL create a Tavus Persona dynamically using a system prompt that instructs the AI to roleplay as the selected person, with scraped intel injected into the Tavus knowledge base.
2. WHEN the Tavus Persona creation is initiated, THEN the NetWork system SHALL display a loading state to the user and poll for persona readiness; WHEN the persona is ready, THEN the system SHALL initiate a Tavus CVI session and return a session URL to the user.
3. WHEN the Tavus session ends normally, THEN the NetWork system SHALL retrieve the session Transcript from Tavus and save it to Supabase linked to the user, context, and Persona.
4. WHEN a user starts a video session, THEN the NetWork system SHALL place a Minute Reservation on the user's account in a single atomic database transaction before initiating the Tavus session.
5. WHEN a video session ends, THEN the NetWork system SHALL convert the Minute Reservation to actual consumption based on the session's actual duration in minutes, and release any unused reserved minutes back to the user's allowance.
6. IF the Tavus connection drops during an active session, THEN the NetWork system SHALL save any Transcript content collected up to that point, release the unused reserved minutes back to the user's allowance, and display a session interruption message.

---

### Requirement 6: Post-Session Debrief

**User Story:** As a user, I want structured feedback immediately after each Practice Session, so that I can identify strengths and areas to improve.

#### Acceptance Criteria

1. WHEN a session Transcript is saved, THEN the NetWork system SHALL send the Transcript to the Claude API with a debrief prompt and generate a structured Debrief report within 30 seconds.
2. WHEN generating the Debrief report, THEN the NetWork system SHALL score the session across four dimensions — openers, question quality, response relevance, and closing — each on a scale of 1 to 10, derived from the text content of the Transcript.
3. WHEN generating the Debrief report, THEN the NetWork system SHALL identify up to 3 specific moments in the Transcript where the user could have responded more effectively and provide a suggested alternative response for each.
4. WHEN the Debrief report is generated, THEN the NetWork system SHALL produce a homework list of exactly 3 actionable drills the user can complete before their next session.
5. THE NetWork system SHALL persist all generated Debrief reports according to the Serialization Standard, linked to the session in Supabase.
6. IF the Claude API fails or times out during Debrief generation, THEN the NetWork system SHALL retry once after a 2-second delay and, if the retry fails, notify the user that feedback is temporarily unavailable and store the Transcript so the Debrief can be generated when the service recovers.

---

### Requirement 7: Session Replay

**User Story:** As a user, I want to retry a practice session with the same persona to try a different approach, so that I can experiment with different conversation strategies and improve faster.

#### Acceptance Criteria

1. WHEN a user views a completed session's Debrief, THEN the NetWork system SHALL display a "Retry with same persona" button.
2. WHEN a user clicks "Retry with same persona", THEN the NetWork system SHALL start a new Practice Session using the same Person Card, intel chunks, and session type (voice or video) as the original session.
3. WHEN a retry session is started, THEN the NetWork system SHALL link the new session to the same context and Person Card as the original, and SHALL place a new Minute Reservation.
4. WHEN viewing session history, THEN the NetWork system SHALL group retry sessions under the original session so users can compare their performance across attempts.

---

### Requirement 8: Session History

**User Story:** As a user, I want to view my past sessions and their feedback, so that I can review what I practiced and track improvement over time.

#### Acceptance Criteria

1. WHEN a user navigates to the History screen, THEN the NetWork system SHALL display a list of all past Practice Sessions for that user, ordered by most recent first.
2. WHEN a user selects a past session, THEN the NetWork system SHALL display the full Debrief report and Transcript for that session.
3. WHEN a user views the progress dashboard, THEN the NetWork system SHALL display average scores per dimension across all sessions completed in the current billing period.

---

### Requirement 9: User Authentication

**User Story:** As a user, I want to create an account and sign in, so that my prep materials and session history are saved and accessible across devices.

#### Acceptance Criteria

1. WHEN a new user registers, THEN the NetWork system SHALL create a user record in Supabase with a default account state, voice and video minute counters initialized to zero, and a billing_period_start field set to the first day of the current calendar month.
2. WHEN a registered user signs in, THEN the NetWork system SHALL authenticate the user via Supabase Auth and restore their session context, history, and account state.
3. IF authentication fails, THEN the NetWork system SHALL display a descriptive error message and not grant access to any user data.

---

### Requirement 10: Privacy, Data Handling, and Compliance

**User Story:** As a user and as a subject of scraped data, I want the system to handle personal information responsibly, so that privacy rights are respected and legal risks are minimized.

#### Acceptance Criteria

1. WHEN a user account is deleted, THEN the NetWork system SHALL permanently delete all associated Transcripts, Debrief reports, Talking Points Cards, Person Cards, and Pinecone vectors within 24 hours.
2. THE NetWork system SHALL automatically delete all scraped intel stored in Pinecone and Supabase after the Data Retention Period.
3. WHEN a user requests export of their personal data, THEN the NetWork system SHALL produce a JSON export of all stored data associated with that user within 48 hours.
4. WHEN Intel Gathering is about to begin, THEN the NetWork system SHALL display a consent notice stating that publicly available information about named individuals will be retrieved and temporarily stored, and SHALL require the user to confirm before proceeding.
5. IF a user declines the consent notice, THEN the NetWork system SHALL enter Degraded Mode and generate prep content using only the information the user has directly provided, without performing any external scraping or search.
6. THE NetWork system SHALL store no audio or video recordings of Practice Sessions — only the text Transcript.
7. THE NetWork system SHALL log an error with document type and user ID if any serialization or deserialization operation fails.
8. THE NetWork system SHALL display a disclaimer in the terms of service and during Practice Session start stating that AI Personas are simulated practice partners for skill development, not impersonations of real individuals, and that the system does not claim to represent the actual views or behavior of any named person.
9. THE NetWork system is intended for practicing conversations with professional contacts such as recruiters, hiring managers, and industry peers; the system SHALL NOT be used to simulate conversations with public figures, celebrities, or politicians, and the terms of service SHALL explicitly prohibit this use case.

---

### Requirement 11: Reliability and Error Handling

**User Story:** As a user, I want the app to handle API failures gracefully, so that my experience is not disrupted by broken integrations.

#### Acceptance Criteria

1. IF any external API call fails, THEN the NetWork system SHALL retry the call once after a 2-second delay and, if the retry also fails, return a descriptive error message to the user without crashing the application.
2. IF the Tavily or Firecrawl API is unavailable, THEN the NetWork system SHALL enter Degraded Mode and generate prep content using only user-provided inputs.
3. IF the Pinecone service is unavailable, THEN the NetWork system SHALL enter Degraded Mode and generate prep content without RAG retrieval.
4. IF the Vapi or Tavus API is unavailable when a user attempts to start a Practice Session, THEN the NetWork system SHALL display a specific error message and not place a Minute Reservation on the user's account.
5. THE NetWork system SHALL operate on responsive web layouts that function on iOS Safari and Android Chrome without requiring a native app install.
