-- Phase 4: 練習モード用フラグと初回案内の再開位置

ALTER TABLE app_settings ADD COLUMN onboarding_step TEXT NOT NULL DEFAULT 'company';

ALTER TABLE companies ADD COLUMN is_practice_data INTEGER NOT NULL DEFAULT 0
  CHECK (is_practice_data IN (0, 1));

ALTER TABLE clients ADD COLUMN is_practice_data INTEGER NOT NULL DEFAULT 0
  CHECK (is_practice_data IN (0, 1));

ALTER TABLE catalog_items ADD COLUMN is_practice_data INTEGER NOT NULL DEFAULT 0
  CHECK (is_practice_data IN (0, 1));

ALTER TABLE documents ADD COLUMN is_practice_data INTEGER NOT NULL DEFAULT 0
  CHECK (is_practice_data IN (0, 1));

CREATE INDEX idx_clients_is_practice_data ON clients(is_practice_data);
CREATE INDEX idx_catalog_items_is_practice_data ON catalog_items(is_practice_data);
CREATE INDEX idx_documents_is_practice_data ON documents(is_practice_data);
