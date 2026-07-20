-- Phase 5: 機能フラグ(JSON形式で柔軟に追加できるようにする)

ALTER TABLE app_settings ADD COLUMN feature_flags_json TEXT NOT NULL DEFAULT '{}';
