-- ============================================
-- Cron: Auto-close weeks every Sunday at midnight Mexico City (UTC-6)
-- ============================================
-- Prerequisites:
--   1. Enable pg_cron extension:  Extensions → pg_cron (enable in Supabase Dashboard)
--   2. Enable pg_net extension:   Extensions → pg_net  (enable in Supabase Dashboard)
--   3. Deploy the Edge Function:  supabase functions deploy auto-close-weeks
--   4. Run this SQL in the Supabase SQL Editor
--
-- Schedule: 0 6 * * 0 = Every Sunday at 06:00 UTC = 00:00 Mexico City (UTC-6)
-- ============================================

-- Remove existing schedule if re-running this migration
SELECT cron.unschedule('auto-close-weeks')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-close-weeks'
);

-- Schedule the Edge Function call
SELECT cron.schedule(
  'auto-close-weeks',
  '0 6 * * 0',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/auto-close-weeks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
