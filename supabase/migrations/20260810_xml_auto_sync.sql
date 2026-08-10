-- XML ürünlerini 30 dakikada bir güncellemek için Supabase SQL Editor'da çalıştırın.
-- Çalıştırmadan önce xml_import_sources tablosu için add_xml_import_sources.sql dosyasını uygulayın.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Aşağıdaki iki değeri kendi Supabase projenize göre değiştirin.
-- Project URL: Settings > API > Project URL
-- Service role key: Settings > API > service_role (bu anahtarı istemci tarafına koymayın)
SELECT vault.create_secret('SUPABASE_PROJECT_URL', 'xml_auto_sync_project_url');
SELECT vault.create_secret('SUPABASE_SERVICE_ROLE_KEY', 'xml_auto_sync_service_role_key');

CREATE OR REPLACE FUNCTION public.run_xml_auto_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  project_url text;
  service_role_key text;
BEGIN
  SELECT decrypted_secret INTO project_url FROM vault.decrypted_secrets WHERE name = 'xml_auto_sync_project_url' LIMIT 1;
  SELECT decrypted_secret INTO service_role_key FROM vault.decrypted_secrets WHERE name = 'xml_auto_sync_service_role_key' LIMIT 1;

  IF project_url IS NULL OR service_role_key IS NULL THEN
    RAISE EXCEPTION 'XML otomatik güncelleme sırları tanımlı değil.';
  END IF;

  PERFORM net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/xml-auto-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key),
    body := '{}'::jsonb
  );
END;
$$;

-- Aynı isimli eski bir görev varsa önce kaldırır, sonra her 30 dakikada bir kurar.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'xml-auto-sync-every-30-minutes';
SELECT cron.schedule('xml-auto-sync-every-30-minutes', '*/30 * * * *', 'SELECT public.run_xml_auto_sync();');

-- Verilen kaynak 30 dakika aralıkla ve aktif olarak kaydedilir.
INSERT INTO public.xml_import_sources (name, url, allowed_hosts, update_interval_minutes, is_active)
SELECT 'Efsane Baharat ürün XML', 'https://efsanebaharat.appsgo.cloud/urunler.xml', ARRAY['efsanebaharat.appsgo.cloud'], 30, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.xml_import_sources WHERE url = 'https://efsanebaharat.appsgo.cloud/urunler.xml'
);
