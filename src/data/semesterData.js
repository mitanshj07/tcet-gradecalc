export const BRANCHES = [
  { id: 'AIDS', label: 'AI&DS', cycle: 'physics' },
  { id: 'AIML', label: 'AI&ML', cycle: 'chemistry' },
  { id: 'IT', label: 'IT', cycle: 'chemistry' },
  { id: 'COMP', label: 'COMP', cycle: 'physics' },
  { id: 'CIVIL', label: 'CIVIL', cycle: 'physics' },
  { id: 'EXTC', label: 'E&TC', cycle: 'chemistry' },
  { id: 'MECH', label: 'MECH', cycle: 'chemistry' },
  { id: 'MME', label: 'M&ME', cycle: 'chemistry' },
  { id: 'ECS', label: 'E&CS', cycle: 'chemistry' },
  { id: 'IOT', label: 'CSE-IoT', cycle: 'physics' },
  { id: 'CSE', label: 'CSE-CS', cycle: 'physics' },
]

function createSubject({
  code,
  name,
  aliases = [],
  cycle,
  courseRoman,
  theoryCredits = 0,
  practicalCredits = 0,
  hasTheory = theoryCredits > 0,
  hasTW = false,
  hasPR = false,
  hasOR = false,
  isTWOnly = false,
  isNonCredit = false,
  maxMarks = {},
  gradingMode,
  verificationStatus = 'from-index-html',
  sourceNote = '',
  notes = '',
}) {
  const resolvedGradingMode =
    gradingMode ??
    (isNonCredit
      ? 'non-credit'
      : hasTheory && (hasTW || hasPR || hasOR)
        ? 'theory-plus-practical'
        : hasTheory
          ? 'theory'
          : hasTW && (hasPR || hasOR)
            ? 'tw-pr-combined'
            : 'tw-only')

  return {
    code,
    name,
    aliases: Array.from(new Set([code, name, ...aliases])),
    cycle,
    courseRoman,
    theoryCredits,
    practicalCredits,
    totalCredits: theoryCredits + practicalCredits,
    hasTheory,
    hasTW,
    hasPR,
    hasOR,
    isTWOnly,
    isNonCredit,
    maxMarks: {
      ise1: maxMarks.ise1 ?? 20,
      ise2: maxMarks.ise2 ?? 20,
      ise3: maxMarks.ise3 ?? 20,
      ese: maxMarks.ese ?? 60,
      tw: maxMarks.tw ?? (hasTW ? 25 : 0),
      pr: maxMarks.pr ?? (hasPR ? 25 : 0),
      or: maxMarks.or ?? (hasOR ? 25 : 0),
      importedIA: maxMarks.importedIA ?? 40,
    },
    gradingMode: resolvedGradingMode,
    verificationStatus,
    sourceNote: sourceNote || notes,
    parserHints: {
      expectedTheoryBlock: hasTheory,
      expectedPracticalBlock: hasTW || hasPR || hasOR,
      practicalComponentCount: Number(hasTW) + Number(hasPR) + Number(hasOR),
    },
    notes,
  }
}

const PHYSICS_CYCLE_SUBJECTS = [
  createSubject({
    code: 'BSC1101',
    name: 'Physics',
    cycle: 'physics',
    theoryCredits: 3,
    practicalCredits: 1,
    hasTW: true,
    hasPR: true,
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html',
  }),
  createSubject({
    code: 'BSC1102',
    name: 'Mathematics-I',
    cycle: 'physics',
    theoryCredits: 4,
    practicalCredits: 1,
    hasTW: true,
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html',
  }),
  createSubject({
    code: 'ESC1101',
    name: 'Basic Electrical Engineering',
    cycle: 'physics',
    theoryCredits: 3,
    practicalCredits: 1,
    hasTW: true,
    hasPR: true,
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html',
  }),
  createSubject({
    code: 'ESC1102',
    name: 'Engineering Graphics & Design',
    cycle: 'physics',
    theoryCredits: 2,
    practicalCredits: 2,
    hasTW: true,
    hasPR: true,
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html',
  }),
  createSubject({
    code: 'ESC1103',
    name: 'Workshop & Mfg Practices-I',
    cycle: 'physics',
    practicalCredits: 1,
    hasTheory: false,
    hasTW: true,
    isTWOnly: true,
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html',
  }),
  createSubject({
    code: 'HSMC1101',
    name: 'English for General & Professional Communication',
    cycle: 'physics',
    theoryCredits: 2,
    practicalCredits: 1,
    hasTW: true,
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html',
  }),
  createSubject({
    code: 'MC1101',
    name: 'Attitude & Aptitude Development-I / NCC',
    cycle: 'physics',
    isNonCredit: true,
    hasTheory: false,
    maxMarks: { tw: 25 },
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html. Non-credit mandatory, excluded from SGPA.',
  }),
]

const CHEMISTRY_CYCLE_SUBJECTS = [
  createSubject({
    code: 'BSC1201',
    name: 'Chemistry',
    cycle: 'chemistry',
    theoryCredits: 3,
    practicalCredits: 1,
    hasTW: true,
    hasPR: true,
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html',
  }),
  createSubject({
    code: 'BSC1202',
    name: 'Mathematics-I',
    cycle: 'chemistry',
    theoryCredits: 4,
    practicalCredits: 1,
    hasTW: true,
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html',
  }),
  createSubject({
    code: 'ESC1201',
    name: 'Programming for Problem Solving',
    cycle: 'chemistry',
    theoryCredits: 3,
    practicalCredits: 1,
    hasTW: true,
    hasPR: true,
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html',
  }),
  createSubject({
    code: 'ESC1202',
    name: 'Engineering Mechanics',
    cycle: 'chemistry',
    theoryCredits: 3,
    practicalCredits: 1,
    hasTW: true,
    hasPR: true,
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html',
  }),
  createSubject({
    code: 'ESC1203',
    name: 'Workshop & Mfg Practices-I',
    cycle: 'chemistry',
    practicalCredits: 1,
    hasTheory: false,
    hasTW: true,
    isTWOnly: true,
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html',
  }),
  createSubject({
    code: 'HSMC1201',
    name: 'Introduction to Indian Knowledge System',
    cycle: 'chemistry',
    theoryCredits: 2,
    practicalCredits: 1,
    hasTW: true,
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html',
  }),
  createSubject({
    code: 'HME-PS1201',
    name: 'Professional Skills-I (Object Oriented Programming)',
    cycle: 'chemistry',
    practicalCredits: 1,
    hasTheory: false,
    hasTW: true,
    hasPR: true,
    maxMarks: { tw: 22, pr: 18 },
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html. TW max 22 + PR max 18.',
  }),
  createSubject({
    code: 'MC1201',
    name: 'Attitude & Aptitude Development-I',
    cycle: 'chemistry',
    isNonCredit: true,
    hasTheory: false,
    maxMarks: { tw: 25 },
    verificationStatus: 'from-index-html',
    sourceNote: 'Source: old GitHub calculator / index.html. Non-credit mandatory, excluded from SGPA.',
  }),
]

export const SUBJECT_CATALOG = [...PHYSICS_CYCLE_SUBJECTS, ...CHEMISTRY_CYCLE_SUBJECTS]

export function getBranch(branchId) {
  return BRANCHES.find((branch) => branch.id === branchId) ?? BRANCHES[0]
}

export function getResolvedCycle(branchId, semester) {
  const branch = getBranch(branchId)
  const semesterNum = Number(semester)
  if (semesterNum === 1) return branch.cycle
  return branch.cycle === 'physics' ? 'chemistry' : 'physics'
}

export function getRawSubjects(branchId, semester) {
  const cycle = getResolvedCycle(branchId, semester)
  return cycle === 'physics' ? PHYSICS_CYCLE_SUBJECTS : CHEMISTRY_CYCLE_SUBJECTS
}
