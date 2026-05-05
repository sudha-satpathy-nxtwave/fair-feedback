-- Add admin-level Google Sheet webhook URL to admin_config
ALTER TABLE public.admin_config
  ADD COLUMN IF NOT EXISTS admin_sheet_webhook_url TEXT DEFAULT NULL;
