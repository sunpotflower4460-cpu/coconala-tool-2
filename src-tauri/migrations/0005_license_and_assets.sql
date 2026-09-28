-- Phase 7: オフラインのライセンスキーと、ロゴ画像の保存先

-- ライセンスキー(ADR 0009)。秘密情報ではない(署名済みの公開文字列)ためDBへ保存し、
-- バックアップにも含める。検証結果は表示・印刷の透かしにだけ使い、データはロックしない。
ALTER TABLE app_settings ADD COLUMN license_key TEXT;
ALTER TABLE app_settings ADD COLUMN license_activated_at TEXT;

-- ロゴなどの画像。内容のSHA-256をキーにする(同じ画像は1件)。
-- 発行済み書類の会社スナップショットはsha256だけを持つため、画像行は削除しない(発行済み書類の不変性)。
-- plugin-sqlでのBLOBの受け渡しを避けるため、base64のTEXTで保存する。
CREATE TABLE app_assets (
  sha256 TEXT PRIMARY KEY CHECK (length(sha256) = 64),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg')),
  data_base64 TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  created_at TEXT NOT NULL
);

ALTER TABLE companies ADD COLUMN logo_asset_sha256 TEXT REFERENCES app_assets(sha256);
