-- Çoklu XML kaynakları ve kaynak bazlı güncelleme aralığı
-- Supabase SQL Editor'da bir kez çalıştırın.

CREATE TABLE IF NOT EXISTS xml_import_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  allowed_hosts TEXT[] NOT NULL DEFAULT '{}',
  update_interval_minutes INTEGER NOT NULL DEFAULT 15
    CHECK (update_interval_minutes BETWEEN 1 AND 10080),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE xml_import_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view XML import sources" ON xml_import_sources
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Admins can insert XML import sources" ON xml_import_sources
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Admins can update XML import sources" ON xml_import_sources
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid())
  );

-- Mevcut tek kaynak ayarını ilk kaynak olarak taşır.
-- import_url kolonu eski kurulumda yoksa bu INSERT'i atlayabilirsiniz.
INSERT INTO xml_import_sources (name, url, allowed_hosts, update_interval_minutes)
SELECT
  'Varsayılan kaynak',
  import_url,
  COALESCE(import_allowed_hosts, '{}'),
  COALESCE(update_interval_minutes, 15)
FROM bayi_xml_settings
WHERE import_url IS NOT NULL AND trim(import_url) <> ''
  AND NOT EXISTS (SELECT 1 FROM xml_import_sources);
