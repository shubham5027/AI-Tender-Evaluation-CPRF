/*
  # Tender Evaluation System — Core Schema

  1. New Tables
    - `tenders` — Stores tender documents metadata and status
      - `id` (uuid, PK)
      - `title` (text) — Tender title
      - `reference_no` (text, unique) — Government reference number
      - `status` (text) — Draft | Parsing | Parsed | Evaluating | Completed
      - `uploaded_by` (uuid) — FK to auth.users
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `criteria` — Eligibility criteria extracted from tender documents
      - `id` (uuid, PK)
      - `tender_id` (uuid, FK) — Parent tender
      - `name` (text) — Criterion name
      - `category` (text) — Technical | Financial | Compliance
      - `weight` (text) — Mandatory | Optional
      - `description` (text) — Detailed description
      - `threshold` (text) — Required threshold value
      - `created_at` (timestamptz)

    - `bidders` — Bidder submissions for a tender
      - `id` (uuid, PK)
      - `tender_id` (uuid, FK) — Parent tender
      - `name` (text) — Bidder company name
      - `status` (text) — Processing | Completed | Failed
      - `uploaded_by` (uuid) — FK to auth.users
      - `created_at` (timestamptz)

    - `bidder_files` — Individual files uploaded per bidder
      - `id` (uuid, PK)
      - `bidder_id` (uuid, FK) — Parent bidder
      - `file_name` (text) — Original filename
      - `storage_path` (text) — Supabase Storage path
      - `file_type` (text) — PDF | DOC | JPG | PNG
      - `file_size` (bigint) — Size in bytes
      - `ocr_status` (text) — Pending | Processing | Completed | Failed
      - `ocr_text` (text) — Extracted text from OCR
      - `created_at` (timestamptz)

    - `evaluations` — AI evaluation results per bidder per criterion
      - `id` (uuid, PK)
      - `tender_id` (uuid, FK) — Parent tender
      - `bidder_id` (uuid, FK) — Evaluated bidder
      - `criterion_id` (uuid, FK) — Evaluated criterion
      - `extracted_value` (text) — Value extracted from bidder docs
      - `decision` (text) — Eligible | Not Eligible | Review
      - `confidence` (float) — 0-1 confidence score
      - `source_document` (text) — Source file reference
      - `explanation` (text) — AI reasoning
      - `reviewed_by` (uuid, nullable) — Human reviewer
      - `review_comment` (text, nullable) — Reviewer comment
      - `reviewed_at` (timestamptz, nullable) — Review timestamp
      - `created_at` (timestamptz)

    - `activity_logs` — Audit trail for all actions
      - `id` (uuid, PK)
      - `tender_id` (uuid, nullable, FK) — Related tender
      - `action` (text) — Action description
      - `user_id` (uuid, nullable) — Acting user
      - `user_name` (text) — User display name
      - `details` (text, nullable) — Additional details
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on ALL tables
    - Policies restrict access to authenticated users only
    - Users can only modify data within tenders they own or are assigned to
*/

-- Tenders table
CREATE TABLE IF NOT EXISTS tenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  reference_no text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'Draft',
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tenders"
  ON tenders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create tenders"
  ON tenders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can update own tenders"
  ON tenders FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

-- Criteria table
CREATE TABLE IF NOT EXISTS criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Technical',
  weight text NOT NULL DEFAULT 'Mandatory',
  description text DEFAULT '',
  threshold text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view criteria"
  ON criteria FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenders WHERE tenders.id = criteria.tender_id)
  );

CREATE POLICY "Authenticated users can insert criteria"
  ON criteria FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenders WHERE tenders.id = criteria.tender_id AND tenders.uploaded_by = auth.uid())
  );

CREATE POLICY "Authenticated users can update criteria"
  ON criteria FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenders WHERE tenders.id = criteria.tender_id AND tenders.uploaded_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenders WHERE tenders.id = criteria.tender_id AND tenders.uploaded_by = auth.uid())
  );

-- Bidders table
CREATE TABLE IF NOT EXISTS bidders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'Processing',
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bidders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bidders"
  ON bidders FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenders WHERE tenders.id = bidders.tender_id)
  );

CREATE POLICY "Authenticated users can insert bidders"
  ON bidders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenders WHERE tenders.id = bidders.tender_id AND tenders.uploaded_by = auth.uid())
  );

CREATE POLICY "Authenticated users can update bidders"
  ON bidders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenders WHERE tenders.id = bidders.tender_id AND tenders.uploaded_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenders WHERE tenders.id = bidders.tender_id AND tenders.uploaded_by = auth.uid())
  );

-- Bidder files table
CREATE TABLE IF NOT EXISTS bidder_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bidder_id uuid NOT NULL REFERENCES bidders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_type text NOT NULL DEFAULT 'PDF',
  file_size bigint DEFAULT 0,
  ocr_status text NOT NULL DEFAULT 'Pending',
  ocr_text text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bidder_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bidder files"
  ON bidder_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bidders
      JOIN tenders ON tenders.id = bidders.tender_id
      WHERE bidders.id = bidder_files.bidder_id
    )
  );

CREATE POLICY "Authenticated users can insert bidder files"
  ON bidder_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bidders
      JOIN tenders ON tenders.id = bidders.tender_id
      WHERE bidders.id = bidder_files.bidder_id AND tenders.uploaded_by = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update bidder files"
  ON bidder_files FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bidders
      JOIN tenders ON tenders.id = bidders.tender_id
      WHERE bidders.id = bidder_files.bidder_id AND tenders.uploaded_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bidders
      JOIN tenders ON tenders.id = bidders.tender_id
      WHERE bidders.id = bidder_files.bidder_id AND tenders.uploaded_by = auth.uid()
    )
  );

-- Evaluations table
CREATE TABLE IF NOT EXISTS evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL REFERENCES bidders(id) ON DELETE CASCADE,
  criterion_id uuid NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
  extracted_value text NOT NULL DEFAULT '',
  decision text NOT NULL DEFAULT 'Review',
  confidence float NOT NULL DEFAULT 0.5,
  source_document text DEFAULT '',
  explanation text DEFAULT '',
  reviewed_by uuid REFERENCES auth.users(id),
  review_comment text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view evaluations"
  ON evaluations FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenders WHERE tenders.id = evaluations.tender_id)
  );

CREATE POLICY "Authenticated users can insert evaluations"
  ON evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenders WHERE tenders.id = evaluations.tender_id AND tenders.uploaded_by = auth.uid())
  );

CREATE POLICY "Authenticated users can update evaluations"
  ON evaluations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM tenders WHERE tenders.id = evaluations.tender_id AND tenders.uploaded_by = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM tenders WHERE tenders.id = evaluations.tender_id AND tenders.uploaded_by = auth.uid())
  );

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid REFERENCES tenders(id) ON DELETE SET NULL,
  action text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  user_name text DEFAULT 'System',
  details text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_criteria_tender_id ON criteria(tender_id);
CREATE INDEX IF NOT EXISTS idx_bidders_tender_id ON bidders(tender_id);
CREATE INDEX IF NOT EXISTS idx_bidder_files_bidder_id ON bidder_files(bidder_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_tender_id ON evaluations(tender_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_bidder_id ON evaluations(bidder_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_criterion_id ON evaluations(criterion_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tender_id ON activity_logs(tender_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Auto-update updated_at on tenders
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenders_updated_at ON tenders;
CREATE TRIGGER tenders_updated_at
  BEFORE UPDATE ON tenders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
