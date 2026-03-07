# Implementation Plan

- [x] 1. Project setup and core types




  - Initialize Next.js 14 app with TypeScript, Tailwind CSS, and App Router
  - Install dependencies: `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`, `@pinecone-database/pinecone`, `@anthropic-ai/sdk`, `openai`, `fast-check`, `vitest`, `@vitejs/plugin-react`
  - Create all TypeScript interfaces from the design doc: `ContextInput`, `TalkingPointsCard`, `PersonCard`, `Transcript`, `TranscriptTurn`, `DebriefReport`, `DebriefScores`, `DebriefMoment`, `MinuteReservation`
  - Create `src/types/index.ts` exporting all interfaces
  - Create `src/lib/claude.ts`: shared Claude API client using `@anthropic-ai/sdk` with `ANTHROPIC_API_KEY` env var
  - Create `src/lib/openai.ts`: shared OpenAI client for embeddings with `OPENAI_API_KEY` env var
  - _Requirements: 3.1, 3.2, 4.1, 5.1, 6.1_
make com
- [x] 2. Supabase setup and database schema




  - Create Supabase project and configure environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
  - Apply the full database migration from the design doc: `users`, `contexts`, `person_cards`, `sessions`, `debriefs` tables with all indexes
  - Enable Row Level Security on all tables; add policies so users can only read/write their own rows
  - Create `src/lib/supabase.ts` (browser client) and `src/lib/supabase-server.ts` (server client)
  - _Requirements: 8.1, 9.1_

- [x] 3. Authentication





  - Implement `/auth/register` and `/auth/login` pages using Supabase Auth (email + password)
  - Registration page SHALL include a checkbox requiring users to acknowledge the terms of service (including persona simulation disclaimer) before account creation
  - Create `POST /api/auth/register` route that creates the Supabase auth user and inserts a row into `users` with `billing_period_start` set to the first of the current month and counters at zero
  - Add auth middleware to protect all `/api/*` routes except auth routes
  - _Requirements: 9.1, 9.2, 9.3, 10.8, 10.9_

- [x] 3.1 Write unit test for new user record defaults


  - Verify that after registration, the `users` row has `voice_minutes_used = 0`, `video_minutes_used = 0`, `tier = 'free'`, and `billing_period_start` equal to the first of the current month
  - _Requirements: 8.1_

- [x] 4. Utility: retry wrapper





  - Implement `withRetry<T>(fn, delayMs)` in `src/lib/retry.ts` with both-error logging as specified in the design doc
  - _Requirements: 10.1_

- [x] 4.1 Write property test for retry wrapper invocation count


  - **Property 11: Retry wrapper invocation count**
  - **Validates: Requirements 10.1**

- [x] 5. Serialization utilities





  - Implement `serialize<T>(obj: T): string` and `deserialize<T>(json: string): T` in `src/lib/serialization.ts`
  - These are thin wrappers around `JSON.stringify` / `JSON.parse` with error logging (logs document type and user ID on failure per Req 9.7)
  - _Requirements: 9 (Serialization Standard), 9.7_

- [x] 5.1 Write property test for prep document serialization round-trip


  - **Property 3: Serialization round-trip for prep documents**
  - **Validates: Requirements 3.5, 9 (Serialization Standard)**

- [x] 5.2 Write property test for debrief report serialization round-trip


  - **Property 4: Serialization round-trip for debrief reports**
  - **Validates: Requirements 6.5, 9 (Serialization Standard)**

- [x] 6. Intel pipeline — scraping and OCR





  - Implement `src/services/intel/scraper.ts`: `scrapeUrl(url: string)` using Firecrawl SDK; returns extracted markdown text or throws on failure
  - Implement `src/services/intel/ocr.ts`: `extractTextFromImage(storagePath: string)` using Tesseract.js; returns extracted text string
  - Implement `src/services/intel/entityExtractor.ts`: `extractEntities(text: string)` — calls Claude API to extract names, roles, companies, topics from free text; returns structured `ExtractedEntities`
  - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [x] 7. Intel pipeline — embedding and Pinecone





  - Implement `src/services/intel/embedding.ts`: `embedChunks(chunks: string[])` using OpenAI `text-embedding-3-small`; returns float arrays
  - Implement `src/services/intel/vectorStore.ts`: `upsertIntel(namespace, chunks, embeddings)` and `retrieveIntel(namespace, queryEmbedding, topK = 5)` using Pinecone SDK
  - Namespace format: `{userId}/{contextId}/{participantName}`
  - _Requirements: 2.2, 2.3_

- [x] 7.1 Write property test for Pinecone retrieval count bound




  - **Property 10: Pinecone retrieval count bound**
  - **Validates: Requirements 2.3**

- [x] 8. Intel pipeline — Tavily agentic search and IntelService orchestration





  - Implement `src/services/intel/search.ts`: `searchParticipant(name: string, company: string)` using Tavily SDK; returns array of text snippets from past 30 days
  - Implement `src/services/IntelService.ts` that orchestrates: consent check → Firecrawl scrape → Tavily search → OCR → entity extraction → embed → Pinecone upsert; enters Degraded Mode on any external failure
  - **Token limit management**: Implement chunk budget of 2,000 characters per person; truncate scraped/searched content to first 2,000 characters before embedding to prevent Claude context overflow
  - `IntelService.gatherIntel(contextInput, consentGiven)` returns `{ participants: ExtractedParticipant[], degradedMode: boolean }`
  - _Requirements: 2.1, 2.4, 2.5, 2.6, 9.4, 9.5_

- [x] 8.1 Write property test for consent gate on intel pipeline


  - **Property 14: Consent gate on intel pipeline**
  - **Validates: Requirements 9.4, 9.5**

- [x] 9. Prep generation — PrepService





  - Implement `src/services/PrepService.ts`
  - `generateTalkingPointsCard(contextInput, participants, intelChunks, degradedMode)` — calls Claude API with structured prompt; returns `TalkingPointsCard`
  - `generatePersonCard(participant, intelChunks, degradedMode)` — calls Claude API; returns `PersonCard` with `limitedResearch: true` when `intelChunks` is empty
  - Both functions use `withRetry` for the Claude call
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 9.1 Write property test for TalkingPointsCard structural invariant


  - **Property 1: TalkingPointsCard structural invariant**
  - **Validates: Requirements 3.1**

- [x] 9.2 Write property test for PersonCard structural invariant


  - **Property 2: PersonCard structural invariant**
  - **Validates: Requirements 3.2**

- [x] 10. Context API route and prep flow wiring





  - Implement `POST /api/context`: validates input including `consentGiven` boolean field; rejects request with 400 if `consentGiven` is false or missing (server-side consent enforcement); calls `IntelService.gatherIntel`, calls `PrepService` for each participant, persists context + cards to Supabase via Serialization Standard, returns `contextId`
  - Implement `GET /api/context/[contextId]`: fetches and deserializes context, talking points card, and all person cards for the authenticated user
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.5, 10.4_

- [x] 11. Checkpoint — ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.
  - Expected passing tests at this checkpoint: Properties 1, 2, 3, 4, 10, 11, 14; unit test 3.1

- [x] 12. Session prompt builder





  - Implement `src/services/session/promptBuilder.ts`: `buildSystemPrompt(persona: PersonCard, intelChunks: string[], contextInput: ContextInput): string`
  - The prompt instructs the AI to roleplay as the persona and embeds all intel chunks inline
  - **Persona hallucination guardrail**: Include explicit instruction in system prompt: "If you do not have specific information about a participant's past experience or interests, do not invent them. Instead, act as a slightly reserved professional contact who is meeting the user for the first time."
  - _Requirements: 4.1, 4.2, 5.1_

- [x] 12.1 Write property test for session prompt construction


  - **Property 6: Session prompt construction contains all intel chunks**
  - **Validates: Requirements 4.1, 4.2, 5.1**

- [x] 13. Minute reservation and reconciliation





  - Implement `src/services/session/minuteReservation.ts`
  - `placeReservation(sessionId, userId, sessionType)` — atomic Supabase transaction that sets `seconds_reserved` on the session row
  - `reconcileSession(sessionId, durationSeconds)` — sets `seconds_consumed = durationSeconds`, clears `seconds_reserved = 0`, updates `voice_minutes_used` or `video_minutes_used` on the user row using `ceil(durationSeconds / 60)`
  - `releaseReservation(sessionId, elapsedSeconds)` — used on interruption; sets `seconds_consumed = elapsedSeconds`, clears `seconds_reserved`
  - _Requirements: 4.4, 4.5, 4.6, 5.4, 5.5, 5.6_

- [x] 13.1 Write property test for reservation and consumption reconciliation


  - **Property 7: Second-level reservation and consumption reconciliation**
  - **Validates: Requirements 4.4, 4.5, 5.4, 5.5**

- [x] 14. Voice session — Vapi integration





  - Implement `src/services/session/vapiSession.ts`: `startVapiSession(systemPrompt)` — calls Vapi API to initiate a call; returns `vapiCallId`
  - Implement Vapi webhook handler at `POST /api/webhooks/vapi` to receive call end events and transcript; validate webhook signature using `VAPI_WEBHOOK_SECRET` before processing any event
  - **Webhook race condition guardrail**: Before processing end event, check if session status is already `completed` or `interrupted`; if so, ignore the webhook to prevent double-billing or redundant debrief generation
  - On call end: call `SessionService.endSession(sessionId, transcript, durationSeconds)`
  - On call drop: call `SessionService.interruptSession(sessionId, partialTranscript, elapsedSeconds)`
  - _Requirements: 4.1, 4.2, 4.3, 4.6_

- [x] 15. Video session — Tavus integration





  - Implement `src/services/session/tavusSession.ts`:
    - `createTavusPersona(systemPrompt, intelChunks)` — initiates async persona creation; returns `{ personaId, status: 'creating' }`
    - `checkPersonaStatus(personaId)` — polls Tavus API for persona readiness; returns `{ status: 'creating' | 'ready' | 'failed' }`
    - `startTavusSession(personaId)` — called only when persona is ready; returns `{ conversationId, sessionUrl }`
  - Update `sessions` table to include `tavus_persona_status` column (`creating` | `ready` | `failed`)
  - Implement `GET /api/session/[sessionId]/status` endpoint for frontend polling during persona creation
  - Implement Tavus webhook handler at `POST /api/webhooks/tavus` for session end and drop events; validate webhook signature using `TAVUS_WEBHOOK_SECRET` before processing any event
  - **Webhook race condition guardrail**: Before processing end event, check if session status is already `completed` or `interrupted`; if so, ignore the webhook to prevent double-billing or redundant debrief generation
  - On session end: call `SessionService.endSession(sessionId, transcript, durationSeconds)`
  - On drop: call `SessionService.interruptSession(sessionId, partialTranscript, elapsedSeconds)`
  - _Requirements: 5.1, 5.2, 5.3, 5.6_

- [x] 16. SessionService and session API routes




  - Implement `src/services/SessionService.ts` orchestrating: reservation → prompt build → Vapi/Tavus start → transcript save → reconciliation → debrief trigger
  - **Idempotency check**: At the start of `endSession()`, check if `sessions.status` is already `'completed'` or `'interrupted'`; if so, return immediately without processing to prevent race conditions between client and webhook
  - Implement `POST /api/session`: starts session (voice or video), places reservation, returns `{ sessionId, sessionUrl? }`
  - Implement `POST /api/session/[sessionId]/end`: ends session, saves transcript, reconciles minutes, triggers debrief
  - Implement `GET /api/session/[sessionId]`: returns session status and transcript
  - _Requirements: 4.1–4.6, 5.1–5.6_

- [x] 17. Checkpoint — ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
  - Expected passing tests at this checkpoint: Properties 1–7, 10, 11, 14; unit test 3.1

- [x] 18. DebriefService





  - Implement `src/services/DebriefService.ts`
  - `generateDebrief(sessionId)` — reads transcript from sessions row, calls Claude API with debrief prompt, parses structured `DebriefReport`, persists via Serialization Standard
  - On Claude failure: insert `debriefs` row with `pending: true`, `pending_retry_count: 0`
  - Uses `withRetry` for the Claude call
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 18.1 Write property test for DebriefReport structural invariant


  - **Property 5: DebriefReport structural invariant**
  - **Validates: Requirements 6.2, 6.3, 6.4**

- [x] 19. Pending debrief background job





  - Implement a Supabase Edge Function `retry-pending-debriefs` that queries `debriefs where pending = true and pending_retry_count < pending_max_retries`, retries generation, increments `pending_retry_count` on failure, sets `pending = false` on success
  - Schedule via Supabase cron to run every 5 minutes
  - _Requirements: 6.6_

- [x] 20. Debrief API route





  - Implement `GET /api/debrief/[sessionId]`: returns debrief report (or `{ pending: true }` if not yet generated)
  - _Requirements: 6.1_

- [x] 20.1 Session replay feature


  - Add `parent_session_id` nullable column to `sessions` table to link retry sessions to originals
  - Implement `POST /api/session/[sessionId]/retry`: creates a new session using the same `person_card_id`, `context_id`, and `session_type` as the original; sets `parent_session_id` to the original session
  - Update `GET /api/history` to group retry sessions under their parent session
  - Add "Retry with same persona" button to the debrief page that calls the retry endpoint
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 21. Session history and progress dashboard





  - Implement `GET /api/history`: returns all sessions for authenticated user ordered by `created_at DESC`
  - Implement `GET /api/history/progress`: computes per-dimension average scores across all debriefs in the current billing period (using `billing_period_start` from the user row)
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 21.1 Write property test for session history ordering


  - **Property 8: Session history ordering**
  - **Validates: Requirements 7.1**

- [x] 21.2 Write property test for average score computation



  - **Property 9: Average score computation**
  - **Validates: Requirements 7.3**

- [x] 22. Data privacy routes





  - Implement `GET /api/user/export`: serializes all user data (contexts, person_cards, sessions, debriefs) into a single JSON export object with top-level keys for each category
  - Implement `DELETE /api/user`: deletes Supabase auth user (cascades to all tables via `on delete cascade`), inserts a row into a `pinecone_deletion_queue` table with all `person_cards.pinecone_namespace` values for the user
  - Implement a Supabase Edge Function `process-pinecone-deletions` that queries `pinecone_deletion_queue`, deletes the corresponding Pinecone namespaces, marks rows as processed on success, retries up to 5 times on failure, and logs permanently failed deletions for manual review
  - Implement a Supabase Edge Function `cleanup-expired-intel` that deletes contexts and person_cards where `expires_at < now()` and queues corresponding Pinecone namespace deletions
  - Schedule `process-pinecone-deletions` via Supabase cron to run every 5 minutes; schedule `cleanup-expired-intel` to run daily
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 22.1 Write property test for account deletion data removal


  - **Property 12: Account deletion removes all data**
  - **Validates: Requirements 9.1**

- [x] 22.2 Write property test for data export completeness


  - **Property 13: Data export completeness**
  - **Validates: Requirements 9.3**

- [x] 23. Frontend — context input and prep screens
  - Build `/prep` page: context input form with all required fields (event type, industry, user role, user goal, target people), URL input, screenshot upload, plain-text notes; consent notice modal before intel gathering begins
  - Build `/prep/[contextId]` page: displays Talking Points Card and Person Cards; degraded mode banner when applicable
  - Wire to `POST /api/context` and `GET /api/context/[contextId]`
  - _Requirements: 1.1, 2.4, 9.4, 9.5_

- [x] 23.1 Write unit test for context form fields
  - Verify all five required fields (event type, industry, user role, user goal, target people) are present in the rendered form
  - _Requirements: 1.1_

- [x] 24. Frontend — session screen
  - Build `/session/[sessionId]` page with the following UX flow:
    1. **Pre-session state**: Display persona simulation disclaimer with "I understand" checkbox; show Person Card summary and session type (voice/video); "Start Practice" button disabled until disclaimer acknowledged
    2. **Connecting state**: Show loading spinner with "Connecting to [Persona Name]..." message; for video sessions, display "Preparing video avatar..." during async Tavus persona creation; poll `/api/session/[sessionId]/status` every 2 seconds
    3. **Timeout error state**: If Tavus persona creation exceeds 60 seconds, display error message "Video avatar preparation is taking longer than expected. Please try again or switch to voice mode." with retry and fallback options
    4. **Active session state**: Voice mode shows microphone controls, mute button, and elapsed time counter; Video mode embeds Tavus session URL in responsive iframe with elapsed time overlay
    5. **Session controls**: "End Session" button always visible; elapsed time displayed as MM:SS
    6. **Post-session state**: Show "Session complete" message with automatic redirect to debrief page after 2 seconds
  - _Requirements: 4.1, 5.2, 10.8_

- [x] 24.1 Frontend — debrief screen
  - Build `/debrief/[sessionId]` page with the following components:
    1. **Score visualization**: Four radial/gauge charts for openers, question quality, response relevance, and closing (1-10 scale); color-coded (red < 4, yellow 4-6, green > 6)
    2. **Improvable moments section**: Expandable cards showing the user's original response, the AI's suggested alternative, and the turn context from the transcript
    3. **Homework section**: Numbered list of 3 actionable drills with checkboxes for user tracking (state persisted to localStorage; note: localStorage not available in Claude artifacts, use in-memory state for demos)
    4. **Transcript viewer**: Collapsible section showing full conversation with speaker labels and timestamps
    5. **Action buttons**: "Retry with same persona" (calls `/api/session/[sessionId]/retry`), "Practice with different person" (returns to prep page), "View all sessions" (goes to history)
    6. **Loading state**: Skeleton UI while polling `GET /api/debrief/[sessionId]`; "Generating your feedback..." message when `pending: true`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1_

- [x] 24.2 Write unit test for persona simulation disclaimer
  - Verify that the persona simulation disclaimer text is rendered on the session start screen and the "Start Practice" button is disabled until the disclaimer checkbox is checked
  - _Requirements: 10.8_

- [x] 25. Frontend — history and auth screens
  - Build `/history` page:
    1. **Session list**: Cards showing persona name, date, session type badge (voice/video), and overall score average; retry sessions indented under parent with "Attempt #N" label
    2. **Progress dashboard**: Line chart showing score trends over time; bar chart comparing dimension averages for current billing period
    3. **Empty state**: Friendly message with CTA to start first practice session
  - Build `/auth/login` and `/auth/register` pages; include link to terms of service with persona simulation disclaimer
  - _Requirements: 7.4, 8.1, 8.3, 8.1, 8.3, 10.8_

- [x] 26. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Expected passing tests at this checkpoint: All 14 properties; all unit tests (3.1, 23.1, 24.2)
