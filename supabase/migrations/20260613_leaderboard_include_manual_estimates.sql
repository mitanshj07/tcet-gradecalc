DROP POLICY IF EXISTS "Public results readable by all" ON semester_results;

CREATE POLICY "Public results readable by all"
  ON semester_results FOR SELECT
  USING (
    sgpa IS NOT NULL
    AND user_id IN (SELECT id FROM profiles WHERE is_public = true)
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
