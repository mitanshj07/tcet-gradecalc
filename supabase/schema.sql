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

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles viewable" ON profiles;
DROP POLICY IF EXISTS "Public profiles readable by all" ON profiles;
DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
DROP POLICY IF EXISTS "Users manage own results" ON semester_results;
DROP POLICY IF EXISTS "Public results are viewable" ON semester_results;
DROP POLICY IF EXISTS "Public results readable by all" ON semester_results;
DROP POLICY IF EXISTS "Users manage own marks" ON subject_marks;

CREATE POLICY "Public profiles readable by all" ON profiles FOR SELECT USING (is_public = true OR auth.uid() = id);
CREATE POLICY "Users manage own profile" ON profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users manage own results" ON semester_results
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public results readable by all" ON semester_results
  FOR SELECT USING (
    sgpa IS NOT NULL
    AND user_id IN (SELECT id FROM profiles WHERE is_public = true)
  );

CREATE POLICY "Users manage own marks" ON subject_marks
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM semester_results WHERE id = result_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM semester_results WHERE id = result_id)
  );

DROP VIEW IF EXISTS public_leaderboard;
DROP VIEW IF EXISTS leaderboard;
DROP VIEW IF EXISTS leaderboard_stats;
DROP VIEW IF EXISTS leaderboard_view;

CREATE OR REPLACE VIEW leaderboard_view AS
SELECT
  p.id AS user_id,
  COALESCE(
    NULLIF(BTRIM(p.display_name), ''),
    CASE
      WHEN NULLIF(BTRIM(p.name), '') IS NULL THEN 'Anonymous'
      WHEN LENGTH(BTRIM(p.name)) > 2 THEN LEFT(BTRIM(p.name), 1) || REPEAT('*', GREATEST(LENGTH(BTRIM(p.name)) - 2, 1)) || RIGHT(BTRIM(p.name), 1)
      ELSE 'Anonymous'
    END
  ) AS display_name,
  COALESCE(sr.branch, p.branch) AS branch,
  p.batch_year,
  sr.semester,
  sr.academic_year,
  sr.sgpa,
  sr.total_credits,
  sr.updated_at,
  sr.is_official,
  sr.is_locked,
  sr.source,
  RANK() OVER (
    PARTITION BY sr.semester, COALESCE(sr.branch, p.branch)
    ORDER BY sr.sgpa DESC
  ) AS rank_in_branch,
  RANK() OVER (
    PARTITION BY sr.semester
    ORDER BY sr.sgpa DESC
  ) AS rank_overall
FROM semester_results sr
JOIN profiles p ON p.id = sr.user_id
WHERE p.is_public = true
  AND sr.sgpa IS NOT NULL;

CREATE OR REPLACE VIEW leaderboard AS
SELECT
  display_name AS masked_name,
  branch,
  batch_year,
  semester,
  sgpa,
  academic_year,
  is_official,
  rank_in_branch AS rank
FROM leaderboard_view;

CREATE OR REPLACE VIEW public_leaderboard AS
SELECT * FROM leaderboard_view;

CREATE OR REPLACE VIEW leaderboard_stats AS
SELECT
  COALESCE(sr.branch, p.branch) AS branch,
  sr.semester,
  sr.academic_year,
  COUNT(*) AS total_students,
  ROUND(AVG(sr.sgpa)::numeric, 2) AS avg_sgpa,
  ROUND(MAX(sr.sgpa)::numeric, 2) AS max_sgpa,
  ROUND(MIN(sr.sgpa)::numeric, 2) AS min_sgpa,
  COUNT(CASE WHEN sr.sgpa >= 7.84 THEN 1 END) AS distinction_count,
  COUNT(CASE WHEN sr.sgpa >= 6.76 AND sr.sgpa < 7.84 THEN 1 END) AS first_class_count,
  COUNT(CASE WHEN sr.is_official = true THEN 1 END) AS official_count,
  COUNT(CASE WHEN COALESCE(sr.is_official, false) = false THEN 1 END) AS manual_count
FROM semester_results sr
JOIN profiles p ON p.id = sr.user_id
WHERE p.is_public = true
  AND sr.sgpa IS NOT NULL
GROUP BY COALESCE(sr.branch, p.branch), sr.semester, sr.academic_year;

GRANT SELECT ON leaderboard_view TO anon, authenticated;
GRANT SELECT ON leaderboard TO anon, authenticated;
GRANT SELECT ON public_leaderboard TO anon, authenticated;
GRANT SELECT ON leaderboard_stats TO anon, authenticated;
