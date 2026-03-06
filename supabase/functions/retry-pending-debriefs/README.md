# Retry Pending Debriefs Edge Function

This Supabase Edge Function retries generation of pending debrief reports that failed during initial creation.

## Requirements

Implements Requirement 6.6: On Claude API failure during debrief generation, the system SHALL retry once after a 2-second delay and, if the retry fails, store the debrief as pending for background retry.

## Functionality

1. Queries `debriefs` table for records where `pending = true` and `pending_retry_count < pending_max_retries`
2. For each pending debrief:
   - Fetches the session transcript
   - Calls Claude API to generate the debrief report
   - On success: updates the debrief record with the generated report and sets `pending = false`
   - On failure: increments `pending_retry_count`
3. After `pending_max_retries` (default: 5) attempts, the debrief is abandoned

## Scheduling

The function is scheduled to run every 5 minutes via Supabase cron (configured in `supabase/functions/_cron/cron.yaml`).

## Environment Variables

The function requires the following environment variables:

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin access)
- `ANTHROPIC_API_KEY` - Anthropic API key for Claude

## Deployment

### Deploy the Edge Function

```bash
supabase functions deploy retry-pending-debriefs
```

### Set Environment Variables

```bash
supabase secrets set ANTHROPIC_API_KEY=your_api_key_here
```

Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in Edge Functions.

### Enable Cron Schedule

The cron schedule is automatically deployed when you push your project configuration:

```bash
supabase db push
```

Or manually via the Supabase Dashboard:
1. Go to Database > Cron Jobs
2. Create a new cron job with schedule `*/5 * * * *`
3. Set the function to `retry-pending-debriefs`

## Testing

### Manual Invocation

You can manually invoke the function for testing:

```bash
supabase functions invoke retry-pending-debriefs
```

### Test with Pending Debrief

1. Create a pending debrief in the database:

```sql
INSERT INTO debriefs (session_id, user_id, report_data, pending, pending_retry_count)
VALUES (
  'your-session-id',
  'your-user-id',
  '{}',
  true,
  0
);
```

2. Invoke the function manually or wait for the next cron run
3. Check the debrief record to verify it was processed

## Monitoring

Check the Edge Function logs in the Supabase Dashboard:
1. Go to Edge Functions
2. Select `retry-pending-debriefs`
3. View the Logs tab

The function logs:
- Number of pending debriefs found
- Success/failure for each retry attempt
- Final summary with success and failure counts
