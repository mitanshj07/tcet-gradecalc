ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS display_name TEXT;

UPDATE profiles
SET display_name = NULL
WHERE display_name IS NOT NULL
  AND name IS NOT NULL
  AND BTRIM(display_name) = BTRIM(name);

UPDATE semester_results sr
SET is_public = COALESCE(p.is_public, false)
FROM profiles p
WHERE p.id = sr.user_id
  AND COALESCE(sr.is_public, false) IS DISTINCT FROM COALESCE(p.is_public, false);

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

CREATE POLICY "Public profiles readable by all"
  ON profiles FOR SELECT
  USING (is_public = true OR auth.uid() = id);

CREATE POLICY "Users manage own profile"
  ON profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Public results readable by all"
  ON semester_results FOR SELECT
  USING (
    is_locked = true
    AND is_official = true
    AND user_id IN (SELECT id FROM profiles WHERE is_public = true)
  );

CREATE POLICY "Users manage own results"
  ON semester_results FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

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
  AND sr.is_official = true
  AND sr.is_locked = true
  AND sr.sgpa IS NOT NULL;

CREATE OR REPLACE VIEW leaderboard AS
SELECT
  display_name AS masked_name,
  branch,
  batch_year,
  semester,
  sgpa,
  academic_year,
  true AS is_official,
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
  COUNT(CASE WHEN sr.sgpa >= 6.76 AND sr.sgpa < 7.84 THEN 1 END) AS first_class_count
FROM semester_results sr
JOIN profiles p ON p.id = sr.user_id
WHERE p.is_public = true
  AND sr.is_official = true
  AND sr.is_locked = true
  AND sr.sgpa IS NOT NULL
GROUP BY COALESCE(sr.branch, p.branch), sr.semester, sr.academic_year;

GRANT SELECT ON leaderboard_view TO anon, authenticated;
GRANT SELECT ON leaderboard TO anon, authenticated;
GRANT SELECT ON public_leaderboard TO anon, authenticated;
GRANT SELECT ON leaderboard_stats TO anon, authenticated;
