import { calculateSemester, toNumber } from './grading'
import { getAuthProfileFields } from './authDomains'
import { getBranch, getSemesterMeta } from './semesterData'
import { supabase } from './supabase'

const DEFAULT_ACADEMIC_YEAR = '2025-26'

function assertSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }
}

function hasEnteredMarks(marks = {}) {
  return ['ise1', 'ise2', 'ise3', 'importedIA', 'ese', 'tw', 'pr', 'oral'].some(
    (key) => marks[key] !== '' && marks[key] !== null && marks[key] !== undefined,
  )
}

function buildMarksByCode(subjectMarks = []) {
  return subjectMarks.reduce((acc, mark) => {
    acc[mark.subject_code] = {
      ise1: mark.ise1 === null ? '' : String(mark.ise1),
      ise2: mark.ise2 === null ? '' : String(mark.ise2),
      ise3: mark.ise3 === null ? '' : String(mark.ise3),
      importedIA: mark.imported_ia === null ? '' : String(mark.imported_ia),
      ese: mark.ese === null ? '' : String(mark.ese),
      tw: mark.tw === null ? '' : String(mark.tw),
      pr: mark.pr === null ? '' : String(mark.pr),
      oral: mark.oral === null ? '' : String(mark.oral),
    }
    return acc
  }, {})
}

export function mapProfileRow(profileRow, fallbackBranch = 'AIDS') {
  if (!profileRow) {
    return {
      name: '',
      leaderboardName: '',
      branch: fallbackBranch,
      batchYear: '2025',
      rollNo: '',
      isPublic: false,
      tcetVerified: false,
      authProvider: '',
      emailDomain: '',
    }
  }

  return {
    name: profileRow.name ?? '',
    leaderboardName: profileRow.display_name ?? '',
    branch: profileRow.branch ?? fallbackBranch,
    batchYear: profileRow.batch_year ? String(profileRow.batch_year) : '2025',
    rollNo: profileRow.roll_no ?? '',
    isPublic: Boolean(profileRow.is_public),
    tcetVerified: Boolean(profileRow.tcet_verified),
    authProvider: profileRow.auth_provider ?? '',
    emailDomain: profileRow.email_domain ?? '',
  }
}

export async function ensureRemoteProfileAuthFields(userId, user, fallbackBranch = 'AIDS') {
  assertSupabase()
  const authFields = getAuthProfileFields(user)
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        branch: fallbackBranch,
        tcet_verified: authFields.tcetVerified,
        auth_provider: authFields.authProvider,
        email_domain: authFields.emailDomain,
      },
      { onConflict: 'id' },
    )
    .select('*')
    .single()

  if (error) throw error
  return mapProfileRow(data, fallbackBranch)
}

function mapHistoryRow(resultRow, branchId) {
  const resolvedBranchId = resultRow.branch ?? branchId
  const branch = getBranch(resolvedBranchId)
  const subjectMarks = resultRow.subject_marks ?? []
  const earnedCredits = subjectMarks.reduce((sum, mark) => {
    if (!mark.is_passing) return sum
    return sum + (mark.theory_credits ?? 0) + (mark.practical_credits ?? 0)
  }, 0)

  return {
    id: resultRow.id,
    branch: resolvedBranchId,
    branchLabel: branch.label,
    semester: resultRow.semester,
    academicYear: resultRow.academic_year,
    sgpa: Number(resultRow.sgpa),
    totalCredits: resultRow.total_credits ?? 0,
    earnedCredits,
    creditPoints: Number(resultRow.total_credit_points ?? resultRow.credit_points ?? 0),
    isLocked: Boolean(resultRow.is_locked),
    isOfficial: Boolean(resultRow.is_official),
    isPublic: Boolean(resultRow.is_public),
    source: resultRow.source ?? 'manual',
    cycle: resultRow.cycle ?? null,
    officialSgpa: resultRow.official_sgpa === null ? null : Number(resultRow.official_sgpa),
    parserConfidence: resultRow.parser_confidence === null ? null : Number(resultRow.parser_confidence),
    uploadedPdfName: resultRow.uploaded_pdf_name ?? null,
    createdAt: resultRow.updated_at ?? resultRow.created_at ?? new Date().toISOString(),
    marksByCode: buildMarksByCode(subjectMarks),
  }
}

export async function fetchRemoteProfile(userId, fallbackBranch = 'AIDS') {
  assertSupabase()
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

  if (error) throw error
  return data ? mapProfileRow(data, fallbackBranch) : null
}

export async function upsertRemoteProfile(userId, profile, user = null) {
  assertSupabase()
  const authFields = getAuthProfileFields(user)
  const payload = {
    id: userId,
    display_name: profile.leaderboardName?.trim() || null,
    name: profile.name?.trim() || null,
    branch: profile.branch,
    batch_year: Number(profile.batchYear) || null,
    roll_no: profile.rollNo?.trim() || null,
    is_public: Boolean(profile.isPublic),
    tcet_verified: profile.tcetVerified ?? authFields.tcetVerified,
    auth_provider: profile.authProvider || authFields.authProvider,
    email_domain: profile.emailDomain || authFields.emailDomain,
  }

  const { data, error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' }).select('*').single()

  if (error) throw error

  const { error: visibilityError } = await supabase
    .from('semester_results')
    .update({ is_public: Boolean(profile.isPublic) })
    .eq('user_id', userId)

  if (visibilityError) throw visibilityError

  return mapProfileRow(data, profile.branch)
}

export async function fetchRemoteHistory(userId, branchId) {
  assertSupabase()
  const { data, error } = await supabase
    .from('semester_results')
    .select(
      'id, semester, branch, cycle, academic_year, sgpa, total_credits, total_credit_points, credit_points, is_locked, is_official, is_public, source, official_sgpa, parser_confidence, uploaded_pdf_name, created_at, updated_at, subject_marks(subject_code, ise1, ise2, ise3, imported_ia, ese, tw, pr, oral, theory_credits, practical_credits, is_passing)',
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapHistoryRow(row, branchId))
}

export async function saveRemoteSnapshot({
  userId,
  user = null,
  branchId,
  semester,
  marksByCode,
  profile,
  locked = false,
  official = false,
  source = 'manual',
  parserConfidence = null,
  uploadedPdfName = null,
  officialSgpa = null,
  subjectMetadataByCode = {},
}) {
  assertSupabase()
  const meta = getSemesterMeta(branchId, semester)
  const calculation = calculateSemester(meta.subjects, marksByCode)

  if (!calculation.sgpa) {
    throw new Error('Complete at least one credit head before saving.')
  }

  await upsertRemoteProfile(userId, profile, user)

  const payload = {
    user_id: userId,
    semester,
    branch: branchId,
    cycle: meta.cycle,
    scheme_year: 'CBCGS-HME 2023',
    academic_year: DEFAULT_ACADEMIC_YEAR,
    sgpa: Number(calculation.sgpa.toFixed(2)),
    total_credits: calculation.totalCredits,
    total_credit_points: Number(calculation.creditPoints.toFixed(2)),
    credit_points: Number(calculation.creditPoints.toFixed(2)),
    is_locked: locked,
    is_official: official,
    is_public: Boolean(profile.isPublic),
    source,
    official_sgpa: officialSgpa,
    parser_confidence: parserConfidence,
    uploaded_pdf_name: uploadedPdfName,
    uploaded_at: uploadedPdfName ? new Date().toISOString() : null,
  }

  const { data: resultRow, error: resultError } = await supabase
    .from('semester_results')
    .upsert(payload, { onConflict: 'user_id,semester,academic_year' })
    .select(
      'id, semester, branch, cycle, academic_year, sgpa, total_credits, total_credit_points, credit_points, is_locked, is_official, is_public, source, official_sgpa, parser_confidence, uploaded_pdf_name, created_at, updated_at',
    )
    .single()

  if (resultError) throw resultError

  const { error: deleteError } = await supabase.from('subject_marks').delete().eq('result_id', resultRow.id)
  if (deleteError) throw deleteError

  const subjectRows = calculation.subjectResults
    .filter((result) => !result.nonCredit && hasEnteredMarks(result.marks))
    .map((result) => {
      const metadata = subjectMetadataByCode[result.subject.code] ?? {}

      return {
        result_id: resultRow.id,
        subject_code: result.subject.code,
        subject_name: result.subject.name,
        course_roman: result.subject.courseRoman ?? metadata.courseRoman ?? null,
        component_type: result.subject.gradingMode ?? metadata.componentType ?? null,
        ise1: toNumber(result.marks.ise1),
        ise2: toNumber(result.marks.ise2),
        ise3: toNumber(result.marks.ise3),
        imported_ia: toNumber(result.marks.importedIA),
        ese: toNumber(result.marks.ese),
        tw: toNumber(result.marks.tw),
        pr: toNumber(result.marks.pr),
        oral: toNumber(result.marks.oral),
        ia_computed: result.theory?.ia ?? null,
        theory_total: result.theory?.total ?? null,
        theory_grade: result.theory?.grade ?? null,
        theory_gp: result.theory?.gp ?? null,
        practical_total: result.practical?.total ?? null,
        practical_percentage: result.practical?.pct ?? null,
        practical_grade: result.practical?.grade ?? null,
        practical_gp: result.practical?.gp ?? null,
        credits: result.totalCredits,
        theory_credits: result.subject.thCr ?? 0,
        practical_credits: result.subject.practicalCr ?? 0,
        credit_points: Number(result.creditPoints.toFixed(2)),
        is_passing: result.completed ? result.failures.length === 0 : null,
        atkt_reason: result.failures.map((failure) => `${failure.head}: ${failure.detail}`).join('; ') || null,
        source: metadata.source ?? source,
        parse_confidence: metadata.parseConfidence ?? parserConfidence,
        raw_subject_line: metadata.rawSubjectLine ?? null,
        parsed_official_credits: metadata.parsedOfficialCredits ?? null,
        template_credits_used: metadata.templateCreditsUsed ?? result.totalCredits,
      }
    })

  if (subjectRows.length) {
    const { error: insertError } = await supabase.from('subject_marks').insert(subjectRows)
    if (insertError) throw insertError
  }

  return {
    id: resultRow.id,
    branch: branchId,
    branchLabel: meta.branch.label,
    semester: resultRow.semester,
    academicYear: resultRow.academic_year,
    sgpa: Number(resultRow.sgpa),
    totalCredits: resultRow.total_credits ?? 0,
    earnedCredits: calculation.earnedCredits,
    creditPoints: Number(resultRow.total_credit_points ?? resultRow.credit_points ?? 0),
    isLocked: Boolean(resultRow.is_locked),
    isOfficial: Boolean(resultRow.is_official),
    isPublic: Boolean(resultRow.is_public),
    source: resultRow.source ?? source,
    officialSgpa: resultRow.official_sgpa === null ? null : Number(resultRow.official_sgpa),
    parserConfidence: resultRow.parser_confidence === null ? null : Number(resultRow.parser_confidence),
    uploadedPdfName: resultRow.uploaded_pdf_name ?? null,
    createdAt: resultRow.updated_at ?? resultRow.created_at ?? new Date().toISOString(),
    marksByCode,
  }
}

export async function deleteRemoteSnapshot(resultId) {
  assertSupabase()
  const { error } = await supabase.from('semester_results').delete().eq('id', resultId)
  if (error) throw error
}
