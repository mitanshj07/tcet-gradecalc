// ═══════════════════════════════════════════════════════════════════
// TCET Gazette Parser — Confidence & Grade Validation Utilities V2
// ═══════════════════════════════════════════════════════════════════

/** Official TCET CBCGS grading table (bidirectional lookup) */
const GRADE_TABLE = [
  { grade: 'O', gp: 10, min: 80 },
  { grade: 'A', gp: 9, min: 75 },
  { grade: 'B', gp: 8, min: 70 },
  { grade: 'C', gp: 7, min: 60 },
  { grade: 'D', gp: 6, min: 50 },
  { grade: 'E', gp: 5, min: 45 },
  { grade: 'P', gp: 4, min: 40 },
  { grade: 'F', gp: 0, min: 0 },
]

const GP_TO_GRADE = Object.fromEntries(GRADE_TABLE.map(({ grade, gp }) => [gp, grade]))
const GRADE_TO_GP = Object.fromEntries(GRADE_TABLE.map(({ grade, gp }) => [grade, gp]))
const VALID_GRADES = new Set(GRADE_TABLE.map(({ grade }) => grade))
const VALID_GPS = new Set(GRADE_TABLE.map(({ gp }) => gp))

/** Check if a string is a valid TCET grade letter */
export function isValidGrade(value) {
  return VALID_GRADES.has(String(value).toUpperCase())
}

/** Check if a number is a valid TCET grade point */
export function isValidGP(value) {
  return VALID_GPS.has(Number(value))
}

/** Get grade point for a given grade letter */
export function gradeToGP(grade) {
  return GRADE_TO_GP[String(grade).toUpperCase()] ?? null
}

/** Get grade letter for a given grade point */
export function gpToGrade(gp) {
  return GP_TO_GRADE[Number(gp)] ?? null
}

/** Validate that a (grade, gp) pair is consistent */
export function isValidGradeGPPair(grade, gp) {
  if (!isValidGrade(grade) || !isValidGP(gp)) return false
  return GRADE_TO_GP[String(grade).toUpperCase()] === Number(gp)
}

/** Validate GP × Credits = CreditPoints (within tolerance) */
export function isValidCreditProduct(gp, credits, creditPoints, tolerance = 0.5) {
  if (!Number.isFinite(gp) || !Number.isFinite(credits) || !Number.isFinite(creditPoints)) return false
  return Math.abs(gp * credits - creditPoints) <= tolerance
}

/** Validate ESE + IA = Total (exact) */
export function isValidTheoryTotal(ese, ia, total) {
  if (!Number.isFinite(ese) || !Number.isFinite(ia) || !Number.isFinite(total)) return false
  return ese + ia === total
}

/** Validate TW + PR = Total (exact) */
export function isValidPracticalTotal(tw, pr, total) {
  if (!Number.isFinite(tw) || !Number.isFinite(total)) return false
  return tw + (pr ?? 0) === total
}

/** Score a list of warnings to produce a confidence penalty */
export function scoreWarnings(warnings = []) {
  return warnings.reduce((score, warning) => {
    if (/mismatch|could not|empty|scanned/i.test(warning)) return score - 0.2
    if (/missing|review|manual/i.test(warning)) return score - 0.1
    return score - 0.05
  }, 1)
}

/** Compute confidence for a single parsed field */
export function getFieldConfidence({ found = false, exact = false, warnings = [] } = {}) {
  if (!found) return 0
  const base = exact ? 0.95 : 0.75
  return Math.max(0, Math.min(1, base + scoreWarnings(warnings) - 1))
}

/** Combine an array of confidence scores into a weighted average */
export function combineConfidence(parts = []) {
  const filtered = parts.filter((value) => Number.isFinite(value))
  if (!filtered.length) return 0
  return Number((filtered.reduce((sum, value) => sum + value, 0) / filtered.length).toFixed(2))
}

/**
 * Compute a V2 deep-validation confidence score for a parsed subject.
 * Awards bonus for each mathematical check that passes.
 */
export function computeSubjectConfidence({
  hasParsedMarks = false,
  gradeGPValid = false,
  totalValid = false,
  creditProductValid = false,
  warningCount = 0,
} = {}) {
  if (!hasParsedMarks) return 0.1

  let score = 0.5  // base for having parsed marks
  if (gradeGPValid) score += 0.2
  if (totalValid) score += 0.15
  if (creditProductValid) score += 0.15

  // Penalty for warnings (capped)
  score -= Math.min(0.3, warningCount * 0.08)

  return Number(Math.max(0.1, Math.min(1.0, score)).toFixed(2))
}
