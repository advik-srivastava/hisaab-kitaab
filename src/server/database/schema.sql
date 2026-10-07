-- Azure SQL reference schema. Application code accesses these tables only through PlatformRepository.
CREATE TABLE organizations (
  id nvarchar(64) NOT NULL PRIMARY KEY,
  name nvarchar(200) NOT NULL,
  created_at datetime2 NOT NULL
);

CREATE TABLE users (
  id nvarchar(64) NOT NULL,
  organization_id nvarchar(64) NOT NULL,
  email nvarchar(320) NOT NULL,
  display_name nvarchar(200) NOT NULL,
  role nvarchar(32) NOT NULL,
  active bit NOT NULL,
  created_at datetime2 NOT NULL,
  CONSTRAINT pk_users PRIMARY KEY (organization_id, id),
  CONSTRAINT fk_users_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT uq_users_email UNIQUE (organization_id, email)
);

CREATE TABLE policy_sets (
  id nvarchar(64) NOT NULL,
  organization_id nvarchar(64) NOT NULL,
  version int NOT NULL,
  name nvarchar(200) NOT NULL,
  state nvarchar(16) NOT NULL,
  effective_at datetime2 NULL,
  definition_json nvarchar(max) NOT NULL,
  created_by nvarchar(64) NOT NULL,
  created_at datetime2 NOT NULL,
  updated_at datetime2 NOT NULL,
  CONSTRAINT pk_policy_sets PRIMARY KEY (organization_id, id),
  CONSTRAINT uq_policy_version UNIQUE (organization_id, version)
);

CREATE TABLE batches (
  id nvarchar(100) NOT NULL,
  organization_id nvarchar(64) NOT NULL,
  uploaded_by nvarchar(64) NOT NULL,
  uploaded_at datetime2 NOT NULL,
  processed_at datetime2 NULL,
  updated_at datetime2 NOT NULL,
  status nvarchar(32) NOT NULL,
  policy_version_id nvarchar(64) NOT NULL,
  file_count int NOT NULL,
  files_processed int NOT NULL,
  processing_errors_json nvarchar(max) NOT NULL,
  summary_json nvarchar(max) NOT NULL,
  CONSTRAINT pk_batches PRIMARY KEY (organization_id, id)
);

CREATE TABLE source_files (
  id nvarchar(64) NOT NULL,
  organization_id nvarchar(64) NOT NULL,
  batch_id nvarchar(100) NOT NULL,
  original_filename nvarchar(500) NOT NULL,
  storage_filename nvarchar(200) NOT NULL,
  content_type nvarchar(200) NOT NULL,
  byte_size bigint NOT NULL,
  sha256 char(64) NOT NULL,
  scan_status nvarchar(24) NOT NULL,
  blob_key nvarchar(1000) NULL,
  uploaded_at datetime2 NOT NULL,
  CONSTRAINT pk_source_files PRIMARY KEY (organization_id, id),
  CONSTRAINT uq_source_hash UNIQUE (organization_id, sha256)
);

CREATE TABLE transactions (
  id nvarchar(150) NOT NULL,
  organization_id nvarchar(64) NOT NULL,
  batch_id nvarchar(100) NOT NULL,
  payload_json nvarchar(max) NOT NULL,
  vendor_name nvarchar(500) NULL,
  normalized_vendor nvarchar(500) NULL,
  invoice_number nvarchar(300) NULL,
  invoice_date date NULL,
  amount decimal(19,4) NULL,
  currency nvarchar(12) NULL,
  department nvarchar(200) NULL,
  expense_category nvarchar(200) NULL,
  created_at datetime2 NOT NULL,
  row_version rowversion NOT NULL,
  CONSTRAINT pk_transactions PRIMARY KEY (organization_id, id)
);
CREATE INDEX ix_transactions_batch ON transactions(organization_id, batch_id);
CREATE INDEX ix_transactions_search ON transactions(organization_id, invoice_number, vendor_name);

CREATE TABLE rule_results (
  organization_id nvarchar(64) NOT NULL,
  transaction_id nvarchar(150) NOT NULL,
  rule_id nvarchar(100) NOT NULL,
  result_json nvarchar(max) NOT NULL,
  CONSTRAINT pk_rule_results PRIMARY KEY (organization_id, transaction_id, rule_id)
);

CREATE TABLE duplicate_matches (
  id bigint IDENTITY PRIMARY KEY,
  organization_id nvarchar(64) NOT NULL,
  current_transaction_id nvarchar(150) NOT NULL,
  matched_transaction_id nvarchar(150) NOT NULL,
  match_type nvarchar(16) NOT NULL,
  match_json nvarchar(max) NOT NULL
);
CREATE INDEX ix_duplicate_current ON duplicate_matches(organization_id, current_transaction_id);
CREATE INDEX ix_duplicate_matched ON duplicate_matches(organization_id, matched_transaction_id);

CREATE TABLE decisions (
  organization_id nvarchar(64) NOT NULL,
  transaction_id nvarchar(150) NOT NULL,
  batch_id nvarchar(100) NOT NULL,
  status nvarchar(16) NOT NULL,
  risk_priority int NOT NULL,
  decision_json nvarchar(max) NOT NULL,
  CONSTRAINT pk_decisions PRIMARY KEY (organization_id, transaction_id)
);
CREATE INDEX ix_decisions_queue ON decisions(organization_id, batch_id, status, risk_priority DESC);

CREATE TABLE reviewer_assignments (
  organization_id nvarchar(64) NOT NULL,
  transaction_id nvarchar(150) NOT NULL,
  reviewer_id nvarchar(64) NOT NULL,
  assigned_by nvarchar(64) NOT NULL,
  assigned_at datetime2 NOT NULL,
  version int NOT NULL,
  CONSTRAINT pk_assignments PRIMARY KEY (organization_id, transaction_id)
);

CREATE TABLE reviews (
  organization_id nvarchar(64) NOT NULL,
  transaction_id nvarchar(150) NOT NULL,
  action nvarchar(32) NOT NULL,
  reviewer_id nvarchar(64) NOT NULL,
  reviewer_name nvarchar(200) NOT NULL,
  note nvarchar(2000) NULL,
  reviewed_at datetime2 NOT NULL,
  version int NOT NULL,
  CONSTRAINT pk_reviews PRIMARY KEY (organization_id, transaction_id)
);

CREATE TABLE audit_events (
  id nvarchar(64) NOT NULL,
  organization_id nvarchar(64) NOT NULL,
  timestamp datetime2 NOT NULL,
  actor_id nvarchar(64) NULL,
  actor_role nvarchar(32) NOT NULL,
  action nvarchar(64) NOT NULL,
  batch_id nvarchar(100) NULL,
  transaction_id nvarchar(150) NULL,
  note nvarchar(2000) NULL,
  metadata_json nvarchar(max) NULL,
  CONSTRAINT pk_audit_events PRIMARY KEY (organization_id, id)
);
CREATE INDEX ix_audit_transaction ON audit_events(organization_id, transaction_id, timestamp);

CREATE TABLE saved_filters (
  id nvarchar(64) NOT NULL,
  organization_id nvarchar(64) NOT NULL,
  user_id nvarchar(64) NOT NULL,
  name nvarchar(200) NOT NULL,
  query_json nvarchar(max) NOT NULL,
  created_at datetime2 NOT NULL,
  updated_at datetime2 NOT NULL,
  CONSTRAINT pk_saved_filters PRIMARY KEY (organization_id, id)
);

CREATE TABLE notifications (
  id nvarchar(64) NOT NULL,
  organization_id nvarchar(64) NOT NULL,
  user_id nvarchar(64) NOT NULL,
  type nvarchar(64) NOT NULL,
  title nvarchar(300) NOT NULL,
  message nvarchar(1000) NOT NULL,
  created_at datetime2 NOT NULL,
  read_at datetime2 NULL,
  transaction_id nvarchar(150) NULL,
  batch_id nvarchar(100) NULL,
  CONSTRAINT pk_notifications PRIMARY KEY (organization_id, id)
);

CREATE TABLE export_metadata (
  id nvarchar(64) NOT NULL,
  organization_id nvarchar(64) NOT NULL,
  requested_by nvarchar(64) NOT NULL,
  kind nvarchar(32) NOT NULL,
  created_at datetime2 NOT NULL,
  query_json nvarchar(max) NULL,
  batch_id nvarchar(100) NULL,
  CONSTRAINT pk_exports PRIMARY KEY (organization_id, id)
);
