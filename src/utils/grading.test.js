import { describe, expect, it } from 'vitest'
import {
  calculateCGPA,
  computeIA,
  computePractical,
  computeSubjectResult,
  computeTheory,
  getGradeInfo,
  rankSGPAImpacts,
  sgpaRange,
  simulateWhatIf,
  targetESEMarks,
} from './grading'
import { getSemesterMeta, getTotalCredits } from './semesterData'

describe('grading', () => {
  it('applies grade thresholds correctly', () => {
    expect(getGradeInfo(80)).toMatchObject({ grade: 'O', gp: 10 })
    expect(getGradeInfo(75)).toMatchObject({ grade: 'A', gp: 9 })
    expect(getGradeInfo(70)).toMatchObject({ grade: 'B', gp: 8 })
    expect(getGradeInfo(60)).toMatchObject({ grade: 'C', gp: 7 })
    expect(getGradeInfo(50)).toMatchObject({ grade: 'D', gp: 6 })
    expect(getGradeInfo(45)).toMatchObject({ grade: 'E', gp: 5 })
    expect(getGradeInfo(40)).toMatchObject({ grade: 'P', gp: 4 })
    expect(getGradeInfo(39.99)).toMatchObject({ grade: 'F', gp: 0 })
  })

  it('uses best of ISE1/ISE2 plus ISE3 for IA', () => {
    expect(computeIA(14, 18, 12)).toBe(30)
  })

  it('treats blank ISE3 as zero', () => {
    expect(computeIA(12, 17, '')).toBe(17)
  })

  it('uses imported IA when present', () => {
    const theory = computeTheory({ ise1: 10, ise2: 12, ise3: 8, importedIA: 34, ese: 40 })
    expect(theory.ia).toBe(34)
  })

  it('imported IA ignores manual ISE values', () => {
    expect(computeIA({ ise1: 20, ise2: 20, ise3: 20, importedIA: 22 })).toBe(22)
  })

  it('clamps invalid marks', () => {
    const theory = computeTheory({ importedIA: 45, ese: 80 })
    expect(theory.ia).toBe(40)
    expect(theory.ese).toBe(60)
  })

  // === CYCLE / TEMPLATE MAPPING TESTS ===

  it('COMP Sem I resolves to Physics cycle with 21 credits', () => {
    const meta = getSemesterMeta('COMP', 1)
    expect(meta.cycle).toBe('physics')
    expect(meta.subjects[0].name).toBe('Physics')
    expect(getTotalCredits(meta.subjects)).toBe(21)
  })

  it('COMP Sem II resolves to Chemistry cycle with 22 credits', () => {
    const meta = getSemesterMeta('COMP', 2)
    expect(meta.cycle).toBe('chemistry')
    expect(meta.subjects[0].name).toBe('Chemistry')
    expect(getTotalCredits(meta.subjects)).toBe(22)
  })

  it('AIDS Sem I resolves to Physics cycle', () => {
    const meta = getSemesterMeta('AIDS', 1)
    expect(meta.cycle).toBe('physics')
    expect(meta.subjects[0].name).toBe('Physics')
  })

  it('AIDS Sem II resolves to Chemistry cycle', () => {
    const meta = getSemesterMeta('AIDS', 2)
    expect(meta.cycle).toBe('chemistry')
    expect(meta.subjects[0].name).toBe('Chemistry')
  })

  it('IT Sem I resolves to Chemistry cycle', () => {
    const meta = getSemesterMeta('IT', 1)
    expect(meta.cycle).toBe('chemistry')
    expect(meta.subjects[0].name).toBe('Chemistry')
    expect(getTotalCredits(meta.subjects)).toBe(22)
  })

  it('IT Sem II resolves to Physics cycle', () => {
    const meta = getSemesterMeta('IT', 2)
    expect(meta.cycle).toBe('physics')
    expect(meta.subjects[0].name).toBe('Physics')
    expect(getTotalCredits(meta.subjects)).toBe(21)
  })

  it('AIML Sem I resolves to Chemistry cycle', () => {
    const meta = getSemesterMeta('AIML', 1)
    expect(meta.cycle).toBe('chemistry')
  })

  it('AIML Sem II resolves to Physics cycle', () => {
    const meta = getSemesterMeta('AIML', 2)
    expect(meta.cycle).toBe('physics')
  })

  it('Physics cycle total SGPA credits = 21', () => {
    const meta = getSemesterMeta('COMP', 1)
    expect(getTotalCredits(meta.subjects)).toBe(21)
  })

  it('Chemistry cycle total SGPA credits = 22', () => {
    const meta = getSemesterMeta('IT', 1)
    expect(getTotalCredits(meta.subjects)).toBe(22)
  })

  it('Physics cycle subjects match old GitHub source', () => {
    const meta = getSemesterMeta('COMP', 1)
    const codes = meta.subjects.filter((s) => !s.nonCredit).map((s) => s.code)
    expect(codes).toEqual(['BSC1101', 'BSC1102', 'ESC1101', 'ESC1102', 'ESC1103', 'HSMC1101'])
  })

  it('Chemistry cycle subjects match old GitHub source', () => {
    const meta = getSemesterMeta('IT', 1)
    const codes = meta.subjects.filter((s) => !s.nonCredit).map((s) => s.code)
    expect(codes).toEqual(['BSC1201', 'BSC1202', 'ESC1201', 'ESC1202', 'ESC1203', 'HSMC1201', 'HME-PS1201'])
  })

  it('Professional Skills I has tw max 22 and pr max 18', () => {
    const meta = getSemesterMeta('AIML', 1)
    const special = meta.subjects.find((subject) => subject.code === 'HME-PS1201')
    expect(special.twMax).toBe(22)
    expect(special.prMax).toBe(18)
    const practical = computePractical(special, 22, 18)
    expect(practical.max).toBe(40)
    expect(practical.grade).toBe('O')
  })

  it('MC1101 non-credit is excluded from SGPA', () => {
    const meta = getSemesterMeta('COMP', 1)
    const nonCredit = meta.subjects.find((subject) => subject.nonCredit)
    expect(nonCredit.code).toBe('MC1101')
    const result = computeSubjectResult(nonCredit, {})
    expect(result.totalCredits).toBe(0)
    expect(result.creditPoints).toBe(0)
  })

  it('COMP Sem II must not show fake hybrid Chemistry-II/BEE-II/EGD-II list', () => {
    const meta = getSemesterMeta('COMP', 2)
    const names = meta.subjects.map((s) => s.name)
    expect(names).not.toContain('Chemistry-II')
    expect(names).not.toContain('Basic Electrical Engineering-II')
    expect(names).not.toContain('Engineering Graphics-II')
    expect(names).not.toContain('English Communication-II')
    expect(names).toContain('Chemistry')
    expect(names).toContain('Programming for Problem Solving')
  })

  it('IT Sem II must not show fake hybrid list', () => {
    const meta = getSemesterMeta('IT', 2)
    const names = meta.subjects.map((s) => s.name)
    expect(names).not.toContain('Physics-II')
    expect(names).toContain('Physics')
    expect(names).toContain('Basic Electrical Engineering')
  })

  it('importedIA still does not invent ISE1/ISE2/ISE3', () => {
    const theory = computeTheory({ importedIA: 34, ese: 40 })
    expect(theory.ia).toBe(34)
    expect(theory.ese).toBe(40)
  })

  // === SGPA CALCULATION ===

  it('calculates SGPA with credit weighting using chemistry cycle', () => {
    const meta = getSemesterMeta('AIDS', 2)
    const marks = {
      BSC1201: { importedIA: '34', ese: '48' },
      BSC1202: { importedIA: '31', ese: '41' },
      ESC1201: { importedIA: '28', ese: '39', tw: '20', pr: '18' },
      ESC1202: { importedIA: '33', ese: '44', tw: '23', pr: '21' },
      ESC1203: { tw: '22' },
      HSMC1201: { importedIA: '29', ese: '38', tw: '22' },
      'HME-PS1201': { tw: '20', pr: '16' },
    }
    expect(meta.subjects.filter((s) => !s.nonCredit)).toHaveLength(7)
    const semester = meta.subjects.map((subject) => computeSubjectResult(subject, marks[subject.code] ?? {}))
    const creditPoints = semester.reduce((sum, row) => sum + row.creditPoints, 0)
    const countedCredits = semester.reduce((sum, row) => sum + row.creditsCounted, 0)
    expect(countedCredits).toBeGreaterThan(0)
    const sgpa = Number((creditPoints / countedCredits).toFixed(2))
    expect(sgpa).toBeGreaterThan(0)
  })

  it('excludes non-credit courses from SGPA', () => {
    const meta = getSemesterMeta('AIDS', 2)
    const nonCredit = meta.subjects.find((subject) => subject.nonCredit)
    const result = computeSubjectResult(nonCredit, {})
    expect(result.totalCredits).toBe(0)
    expect(result.creditPoints).toBe(0)
  })

  it('flags IA ATKT failures', () => {
    const meta = getSemesterMeta('AIDS', 2)
    const result = computeSubjectResult(meta.subjects[0], { importedIA: '15', ese: '55' })
    expect(result.failures.some((failure) => failure.head === 'IA')).toBe(true)
  })

  it('flags ESE ATKT failures', () => {
    const meta = getSemesterMeta('AIDS', 2)
    const result = computeSubjectResult(meta.subjects[0], { importedIA: '34', ese: '23' })
    expect(result.failures.some((failure) => failure.head === 'ESE')).toBe(true)
  })

  it('flags TW failures', () => {
    const meta = getSemesterMeta('AIDS', 2)
    const result = computeSubjectResult(meta.subjects.find((subject) => subject.code === 'BSC1202'), {
      importedIA: '28',
      ese: '39',
      tw: '9',
    })
    expect(result.failures.some((failure) => failure.head === 'TW')).toBe(true)
  })

  it('flags PR failures', () => {
    const meta = getSemesterMeta('AIDS', 2)
    const result = computeSubjectResult(meta.subjects.find((subject) => subject.code === 'ESC1202'), {
      importedIA: '33',
      ese: '44',
      tw: '20',
      pr: '9',
    })
    expect(result.failures.some((failure) => failure.head === 'PR')).toBe(true)
  })

  it('flags OR failures', () => {
    const practical = computePractical({ tw: 20, oral: 8, twMax: 25, prMax: 0, oralMax: 25 })
    expect(practical.oralPassing).toBe(false)
  })

  it('adjusts only ESE for conservative and optimistic range', () => {
    const meta = getSemesterMeta('AIDS', 2)
    const marks = {
      BSC1201: { importedIA: '34', ese: '48' },
    }
    const range = sgpaRange(meta.subjects, marks)
    expect(range.conservative).not.toBe(range.optimistic)
    expect(marks.BSC1201.importedIA).toBe('34')
  })

  it('target pass uses max of total pass need and ESE passing minimum', () => {
    const targets = targetESEMarks(30)
    expect(targets.P.needed).toBe(24)
  })

  it('simulates what-if ESE changes', () => {
    const meta = getSemesterMeta('AIDS', 2)
    const outcome = simulateWhatIf(meta.subjects, { BSC1201: { importedIA: '34', ese: '40' } }, { subjectCode: 'BSC1201', eseDelta: 10 })
    expect(outcome.newSubjectGrade).toBe('O')
    expect(outcome.sgpaDelta).toBeGreaterThanOrEqual(0)
  })

  it('ranks SGPA impacts for theory subjects', () => {
    const meta = getSemesterMeta('AIDS', 2)
    const rows = rankSGPAImpacts(meta.subjects, { BSC1201: { importedIA: '34', ese: '40' } })
    expect(rows[0]).toHaveProperty('subjectCode')
    expect(rows[0]).toHaveProperty('impacts')
  })

  it('calculates credit-weighted and simple CGPA', () => {
    expect(calculateCGPA([{ sgpa: 8, totalCredits: 20 }, { sgpa: 10, totalCredits: 10 }])).toMatchObject({
      formula: 'credit-weighted',
      cgpa: 8.666666666666666,
    })
    expect(calculateCGPA([{ sgpa: 8 }, { sgpa: 10 }])).toMatchObject({ formula: 'simple-average', cgpa: 9 })
  })
})
