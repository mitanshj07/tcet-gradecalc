CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  name TEXT,
  branch TEXT CHECK (branch IN ('AIDS','AIML','IT','COMP','CIVIL','EXTC','MECH','MME','ECS','IOT','CSE')),
  batch_year INTEGER,
  roll_no TEXT,
  is_public BOOLEAN DEFAULT false,
  tcet_verified BOOLEAN DEFAULT false,
  auth_provider TEXT,
  email_domain TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS semester_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  semester INTEGER CHECK (semester BETWEEN 1 AND 8),
  cycle TEXT,
  branch TEXT,
  scheme_year TEXT DEFAULT 'CBCGS-HME 2023',
  academic_year TEXT,
  sgpa DECIMAL(4,2),
  official_sgpa DECIMAL(4,2),
  total_credits NUMERIC(5,2),
  total_credit_points NUMERIC(6,2),
  credit_points NUMERIC(6,2),
  is_official BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'manual',
  parser_confidence NUMERIC(4,2),
  uploaded_pdf_name TEXT,
  uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, semester, academic_year)
);

CREATE TABLE IF NOT EXISTS subject_marks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  result_id UUID REFERENCES semester_results(id) ON DELETE CASCADE,
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  course_roman TEXT,
  component_type TEXT,
  ise1 NUMERIC(5,2),
  ise2 NUMERIC(5,2),
  ise3 NUMERIC(5,2),
  imported_ia NUMERIC(5,2),
  ese NUMERIC(5,2),
  tw NUMERIC(5,2),
  pr NUMERIC(5,2),
  oral NUMERIC(5,2),
  ia_computed NUMERIC(5,2),
  theory_total NUMERIC(5,2),
  theory_grade TEXT,
  theory_gp NUMERIC(4,2),
  practical_total NUMERIC(5,2),
  practical_percentage NUMERIC(5,2),
  practical_grade TEXT,
  practical_gp NUMERIC(4,2),
  credits NUMERIC(5,2),
  theory_credits NUMERIC(5,2),
  practical_credits NUMERIC(5,2),
  credit_points NUMERIC(6,2),
  is_passing BOOLEAN,
  atkt_reason TEXT,
  source TEXT DEFAULT 'manual',
  parse_confidence NUMERIC(4,2),
  raw_subject_line TEXT,
  parsed_official_credits NUMERIC(5,2),
  template_credits_used NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE VIEW leaderboard AS
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

CREATE OR REPLACE VIEW public_leaderboard AS SELECT * FROM leaderboard;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles viewable" ON profiles;
DROP POLICY IF EXISTS "Users manage own results" ON semester_results;
DROP POLICY IF EXISTS "Users manage own marks" ON subject_marks;

CREATE POLICY "Users view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Public profiles viewable" ON profiles FOR SELECT USING (is_public = true);

CREATE POLICY "Users manage own results" ON semester_results
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public results are viewable" ON semester_results
  FOR SELECT USING (is_public = true AND is_official = true AND is_locked = true);

CREATE POLICY "Users manage own marks" ON subject_marks
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM semester_results WHERE id = result_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM semester_results WHERE id = result_id)
  );
