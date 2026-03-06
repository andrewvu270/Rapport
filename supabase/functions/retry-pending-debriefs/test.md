# Testing the Retry Pending Debriefs Edge Function

## Local Testing (Manual)

Since this is a Supabase Edge Function that runs in Deno, local testing requires the Supabase CLI.

### Prerequisites

1. Install Supabase CLI: https://supabase.com/docs/guides/cli
2. Ensure you have a local Supabase instance running or access to a remote project

### Test Steps

1. **Create a test pending debrief**:

```sql
-- Insert a test session with transcript
INSERT INTO sessions (id, user_id, context_id, session_type, status, transcript, started_at, ended_at)
VALUES (
  'test-session-123',
  'test-user-456',
  'test-context-789',
  'voice',
  'completed',
  '{"turns": [{"speaker": "user", "text": "Hello, nice to meet you!", "timestamp": "2024-01-01T00:00:00Z"}, {"speaker": "persona", "text": "Hello! Great to meet you too!", "timestamp": "2024-01-01T00:00:05Z"}], "durationSeconds": 60, "sessionId": "test-session-123"}',
  NOW(),
  NOW()
);

-- Insert a pending debrief for this session
INSERT INTO debriefs (id, session_id, user_id, report_data, pending, pending_retry_count, pending_max_retries)
VALUES (
  'test-debrief-abc',
  'test-session-123',
  'test-user-456',
  '{}',
  true,
  0,
  5
);
```

2. **Invoke the Edge Function locally**:

```bash
supabase functions serve retry-pending-debriefs
```

In another terminal:

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/retry-pending-debriefs' \
  --header 'Authorization: Bearer YOUR_ANON_KEY'
```

3. **Verify the result**:

```sql
-- Check if the debrief was updated
SELECT id, session_id, pending, pending_retry_count, report_data
FROM debriefs
WHERE id = 'test-debrief-abc';
```

Expected result:
- If Claude API succeeded: `pending = false`, `report_data` contains the generated report
- If Claude API failed: `pending = true`, `pending_retry_count` incremented by 1

### Test Scenarios

#### Scenario 1: Successful Retry
- Pending debrief with valid session transcript
- Claude API is available
- Expected: Debrief generated, `pending = false`

#### Scenario 2: Failed Retry (No Transcript)
- Pending debrief with session that has no transcript
- Expected: `pending_retry_count` incremented, `pending = true`

#### Scenario 3: Max Retries Exceeded
- Pending debrief with `pending_retry_count >= pending_max_retries`
- Expected: Debrief is not processed (filtered out by query)

#### Scenario 4: Claude API Failure
- Pending debrief with valid session
- Claude API returns error
- Expected: `pending_retry_count` incremented, `pending = true`

## Integration Testing

The Edge Function integrates with:
1. Supabase Database (debriefs and sessions tables)
2. Claude API (Anthropic)

Ensure these are properly configured with:
- Valid database connection
- `ANTHROPIC_API_KEY` environment variable set

## Monitoring in Production

After deployment, monitor the function:

1. **Check logs**:
```bash
supabase functions logs retry-pending-debriefs
```

2. **Query pending debriefs**:
```sql
SELECT 
  id, 
  session_id, 
  pending_retry_count, 
  pending_max_retries,
  created_at
FROM debriefs
WHERE pending = true
ORDER BY created_at DESC;
```

3. **Check abandoned debriefs** (exceeded max retries):
```sql
SELECT 
  id, 
  session_id, 
  pending_retry_count, 
  pending_max_retries,
  created_at
FROM debriefs
WHERE pending = true 
  AND pending_retry_count >= pending_max_retries
ORDER BY created_at DESC;
```
