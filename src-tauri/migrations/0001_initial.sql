-- Phase 1: companies / clients / catalog / documents / app_settings
-- 金額はすべて円の整数(INTEGER)で保持する。詳細はdocs/DATA_MODEL.mdを参照。

CREATE TABLE companies (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  display_name TEXT NOT NULL,
  representative_name TEXT,
  postal_code TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  invoice_registration_number TEXT,
  bank_name TEXT,
  bank_branch_name TEXT,
  bank_account_type TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,
  logo_path TEXT,
  estimate_valid_days INTEGER,
  payment_due_days INTEGER,
  default_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_name TEXT,
  postal_code TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_clients_name ON clients(name);

CREATE TABLE catalog_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  unit_price_yen INTEGER NOT NULL,
  cost_price_yen INTEGER,
  tax_category TEXT NOT NULL CHECK (tax_category IN ('taxable_10', 'taxable_8', 'tax_exempt')),
  min_quantity INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_catalog_items_name ON catalog_items(name);
CREATE INDEX idx_catalog_items_is_active ON catalog_items(is_active);

CREATE TABLE catalog_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  catalog_item_id INTEGER NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  alias TEXT NOT NULL
);

CREATE INDEX idx_catalog_aliases_catalog_item_id ON catalog_aliases(catalog_item_id);

CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_type TEXT NOT NULL CHECK (
    document_type IN ('estimate', 'invoice', 'delivery_note', 'receipt')
  ),
  document_number TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'issued', 'approved', 'rejected', 'invoiced', 'paid', 'cancelled')
  ),
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  issue_date TEXT,
  due_date TEXT,
  valid_until TEXT,
  currency TEXT NOT NULL DEFAULT 'JPY',
  pricing_type TEXT NOT NULL DEFAULT 'tax_exclusive' CHECK (
    pricing_type IN ('tax_exclusive', 'tax_inclusive')
  ),
  rounding_mode TEXT NOT NULL DEFAULT 'floor' CHECK (rounding_mode IN ('floor', 'round', 'ceil')),
  discount_yen INTEGER NOT NULL DEFAULT 0,
  subtotal_yen INTEGER NOT NULL DEFAULT 0,
  tax_yen INTEGER NOT NULL DEFAULT 0,
  total_yen INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  company_snapshot_json TEXT,
  client_snapshot_json TEXT,
  calculation_snapshot_json TEXT,
  source_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  issued_at TEXT
);

CREATE INDEX idx_documents_document_type ON documents(document_type);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_client_id ON documents(client_id);

CREATE TABLE document_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  catalog_item_id INTEGER REFERENCES catalog_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  quantity INTEGER NOT NULL,
  unit_price_yen INTEGER NOT NULL,
  tax_category TEXT NOT NULL CHECK (tax_category IN ('taxable_10', 'taxable_8', 'tax_exempt')),
  line_discount_yen INTEGER NOT NULL DEFAULT 0,
  amount_yen INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_document_lines_document_id ON document_lines(document_id);

CREATE TABLE document_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_document_events_document_id ON document_events(document_id);

CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  rounding_mode TEXT NOT NULL DEFAULT 'floor' CHECK (rounding_mode IN ('floor', 'round', 'ceil')),
  document_number_prefix_estimate TEXT NOT NULL DEFAULT 'EST',
  document_number_prefix_invoice TEXT NOT NULL DEFAULT 'INV',
  document_number_prefix_delivery TEXT NOT NULL DEFAULT 'DLV',
  document_number_prefix_receipt TEXT NOT NULL DEFAULT 'RCT',
  theme TEXT NOT NULL DEFAULT 'system',
  ai_enabled INTEGER NOT NULL DEFAULT 0 CHECK (ai_enabled IN (0, 1)),
  onboarding_completed INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_completed IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO app_settings (id, created_at, updated_at) VALUES (1, datetime('now'), datetime('now'));
