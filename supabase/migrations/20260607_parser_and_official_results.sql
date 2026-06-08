ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tcet_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_provider TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_domain TEXT;

UPDATE profiles
SET display_name = COALESCE(display_name, name)
WHERE display_name IS NULL;

ALTER TABLE semester_results ADD COLUMN IF NOT EXISTS cycle TEXT;
ALTER TABLE semester_results ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE semester_results ADD COLUMN IF NOT EXISTS scheme_year TEXT DEFAULT 'CBCGS-HME 2023';
ALTER TABLE semester_results ADD COLUMN IF NOT EXISTS official_sgpa NUMERIC(4,2);
ALTER TABLE semester_results ADD COLUMN IF NOT EXISTS total_credit_points NUMERIC(6,2);
ALTER TABLE semester_results ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT false;
ALTER TABLE semester_results ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE semester_results ADD COLUMN IF NOT EXISTS parser_confidence NUMERIC(4,2);
ALTER TABLE semester_results ADD COLUMN IF NOT EXISTS uploaded_pdf_name TEXT;
ALTER TABLE semester_results ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;
ALTER TABLE semester_results ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

UPDATE semester_results
SET total_credit_points = COALESCE(total_credit_points, credit_points)
WHERE total_credit_points IS NULL;

ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS course_roman TEXT;
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS component_type TEXT;
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS imported_ia NUMERIC(5,2);
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS oral NUMERIC(5,2);
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS theory_gp NUMERIC(4,2);
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS practical_total NUMERIC(5,2);
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS practical_percentage NUMERIC(5,2);
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS practical_gp NUMERIC(4,2);
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS credits NUMERIC(5,2);
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS credit_points NUMERIC(6,2);
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS atkt_reason TEXT;
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS parse_confidence NUMERIC(4,2);
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS raw_subject_line TEXT;
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS parsed_official_credits NUMERIC(5,2);
ALTER TABLE subject_marks ADD COLUMN IF NOT EXISTS template_credits_used NUMERIC(5,2);

DROP VIEW IF EXISTS public_leaderboard;
DROP VIEW IF EXISTS leaderboard;

CREATE VIEW leaderboard AS
SELECT
  CASE
    WHEN COALESCE(p.display_name, p.name, '') = '' THEN 'Anonymous'
    ELSE LEFT(COALESCE(p.display_name, p.name), 1) || repeat('*', GREATEST(length(COALESCE(p.display_name, p.name)) - 1, 2))
  END AS masked_name,
  p.branch,
  p.batch_year,
  sr.semester,
  sr.sgpa,
  sr.academic_year,
  sr.is_official,
  p.tcet_verified,
  RANK() OVER (PARTITION BY sr.semester, p.branch ORDER BY sr.sgpa DESC) AS rank
FROM semester_results sr
JOIN profiles p ON p.id = sr.user_id
WHERE p.is_public = true
  AND sr.is_public = true
  AND sr.is_official = true
  AND sr.is_locked = true;

CREATE VIEW public_leaderboard AS SELECT * FROM leaderboard;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Users manage own results" ON semester_results;
DROP POLICY IF EXISTS "Users manage own marks" ON subject_marks;

CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users manage own results" ON semester_results
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own marks" ON subject_marks
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM semester_results WHERE id = result_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM semester_results WHERE id = result_id)
  );
