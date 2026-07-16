-- Phase 3: AIモデル設定と、問い合わせ抽出結果の保存(APIキーは含めない)

ALTER TABLE app_settings ADD COLUMN ai_model TEXT NOT NULL DEFAULT 'claude-sonnet-5';

CREATE TABLE ai_extractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_text TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model TEXT,
  result_json TEXT NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0 CHECK (confirmed IN (0, 1)),
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  confirmed_at TEXT
);

CREATE INDEX idx_ai_extractions_document_id ON ai_extractions(document_id);
