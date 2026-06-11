import { getRawSubjectRows } from './semesterData'

function creditSubjects(branch, semester) {
  return getRawSubjectRows(branch, semester).filter((subject) => !subject.isNonCredit)
}

function nonCreditSubjects(branch, semester) {
  return getRawSubjectRows(branch, semester).filter((subject) => subject.isNonCredit)
}

function withCourseMetadata(subjects, courseOrder, sourceNote, verificationStatus) {
  const courseByCode = new Map(courseOrder.map((course, index) => [course.subjectCode, { ...course, index: index + 1 }]))

  return subjects.map((subject) => {
    const course = courseByCode.get(subject.code)
    return {
      ...subject,
      courseRoman: course?.roman,
      verificationStatus: verificationStatus ?? subject.verificationStatus,
      sourceNote: sourceNote ?? subject.sourceNote,
      parserHints: {
        ...subject.parserHints,
        officeRegisterOrder: course?.index,
      },
    }
  })
}

function createTemplate({
  templateId,
  key,
  aliases = [],
  label,
  name,
  semester,
  cycle,
  scheme,
  branchIds,
  courseOrder,
  subjects,
  nonCreditSubjects,
  verificationStatus,
  sourceNote,
  subjectLayoutName,
}) {
  return {
    templateId,
    key,
    aliases,
    label,
    name,
    semester,
    cycle,
    scheme,
    branchIds,
    courseOrder,
    subjects,
    nonCreditSubjects,
    verificationStatus,
    sourceNote,
    subjectLayoutName,
  }
}

// ═══════════════════════════════════════════════
// SEM I OFFICE REGISTER TEMPLATES (gazette parser)
// ═══════════════════════════════════════════════

const FE_SEM1_PHYSICS_COURSES = [
  { roman: 'I', expectedName: 'Physics', subjectCode: 'BSC1101' },
  { roman: 'II', expectedName: 'Mathematics-I', subjectCode: 'BSC1102' },
  { roman: 'III', expectedName: 'Basic Electrical Engineering', subjectCode: 'ESC1101' },
  { roman: 'IV', expectedName: 'Engineering Graphics & Design', subjectCode: 'ESC1102' },
  { roman: 'V', expectedName: 'Workshop & Manufacturing Practices-I', subjectCode: 'ESC1103' },
  { roman: 'VI', expectedName: 'English for General & Professional Communication', subjectCode: 'HSMC1101' },
  { roman: 'VII', expectedName: 'Attitude & Aptitude Development-1 / NCC', subjectCode: 'MC1101', nonCredit: true },
]

const FE_SEM1_CHEMISTRY_COURSES = [
  { roman: 'I', expectedName: 'Chemistry', subjectCode: 'BSC1201' },
  { roman: 'II', expectedName: 'Mathematics-I', subjectCode: 'BSC1202' },
  { roman: 'III', expectedName: 'Programming for Problem Solving', subjectCode: 'ESC1201' },
  { roman: 'IV', expectedName: 'Engineering Mechanics', subjectCode: 'ESC1202' },
  { roman: 'V', expectedName: 'Workshop & Manufacturing Practices-I', subjectCode: 'ESC1203' },
  { roman: 'VI', expectedName: 'Introduction to Indian Knowledge System', subjectCode: 'HSMC1201' },
  { roman: 'VII', expectedName: 'Attitude & Aptitude Development-1', subjectCode: 'MC1201', nonCredit: true },
  { roman: 'VIII', expectedName: 'Professional Skills-I (Object Oriented Programming)', subjectCode: 'HME-PS1201' },
]

export const FE_SEM1_PHYSICS_CYCLE = createTemplate({
  templateId: 'FE_SEM1_PHYSICS_CYCLE',
  key: 'sem1-physics-office-register',
  aliases: ['physics-cycle-subject-template'],
  label: 'Physics Cycle Office Register',
  name: 'Physics Cycle Office Register',
  semester: 1,
  cycle: 'physics',
  scheme: 'HME 2023',
  branchIds: ['AIDS', 'COMP', 'CIVIL', 'IOT', 'CSE'],
  courseOrder: FE_SEM1_PHYSICS_COURSES,
  nonCreditSubjects: nonCreditSubjects('AIDS', 1),
  verificationStatus: 'from-index-html',
  sourceNote: 'Source: old GitHub calculator / index.html. Also verified against uploaded AI&DS and COMP Sem I office-register gazettes.',
  subjectLayoutName: 'physics-cycle-subject-template',
})
FE_SEM1_PHYSICS_CYCLE.subjects = withCourseMetadata(
  creditSubjects('AIDS', 1),
  FE_SEM1_PHYSICS_CYCLE.courseOrder,
  FE_SEM1_PHYSICS_CYCLE.sourceNote,
  'from-index-html',
)

export const FE_SEM1_CHEMISTRY_CYCLE = createTemplate({
  templateId: 'FE_SEM1_CHEMISTRY_CYCLE',
  key: 'sem1-chemistry-office-register',
  aliases: ['chemistry-cycle-subject-template'],
  label: 'Chemistry Cycle Office Register',
  name: 'Chemistry Cycle Office Register',
  semester: 1,
  cycle: 'chemistry',
  scheme: 'HME 2023',
  branchIds: ['IT', 'AIML', 'EXTC', 'ECS', 'MECH', 'MME'],
  courseOrder: FE_SEM1_CHEMISTRY_COURSES,
  nonCreditSubjects: nonCreditSubjects('IT', 1),
  verificationStatus: 'from-index-html',
  sourceNote: 'Source: old GitHub calculator / index.html. Also verified against uploaded IT Sem I office-register gazette.',
  subjectLayoutName: 'chemistry-cycle-subject-template',
})
FE_SEM1_CHEMISTRY_CYCLE.subjects = withCourseMetadata(
  creditSubjects('IT', 1),
  FE_SEM1_CHEMISTRY_CYCLE.courseOrder,
  FE_SEM1_CHEMISTRY_CYCLE.sourceNote,
  'from-index-html',
)

// ═══════════════════════════════════════════════
// SEM II OFFICE REGISTER TEMPLATES
// These are gazette-parser templates for Sem II PDFs.
// The calculator uses the same canonical Physics/Chemistry cycle subjects.
// The Sem II gazette PDFs may use different course numbering (e.g. Mathematics-II)
// but the underlying subject template is the SAME canonical cycle.
// ═══════════════════════════════════════════════

// Sem II Physics template: used by chemistry-cycle branches (IT, AIML, etc.) in Sem II
// The gazette header says "Mathematics-II" etc. but the credit structure is identical to Physics cycle.
const FE_SEM2_PHYSICS_COURSES = [
  { roman: 'I', expectedName: 'Physics', subjectCode: 'BSC1101' },
  { roman: 'II', expectedName: 'Mathematics-II', subjectCode: 'BSC1102' },
  { roman: 'III', expectedName: 'Basic Electrical Engineering', subjectCode: 'ESC1101' },
  { roman: 'IV', expectedName: 'Engineering Graphics & Design', subjectCode: 'ESC1102' },
  { roman: 'V', expectedName: 'Workshop & Manufacturing Practices-II', subjectCode: 'ESC1103' },
  { roman: 'VI', expectedName: 'English for General & Professional Communication', subjectCode: 'HSMC1101' },
  { roman: 'VII', expectedName: 'Summer Internship', subjectCode: 'ESC1103' },
  { roman: 'VIII', expectedName: 'Attitude & Aptitude Development-II', subjectCode: 'MC1101', nonCredit: true },
]

export const FE_SEM2_PHYSICS_TEMPLATE = createTemplate({
  templateId: 'FE_SEM2_PHYSICS_TEMPLATE',
  key: 'sem2-physics-office-register',
  aliases: ['sem2-physics-pattern', 'sem2-physics-subject-template'],
  label: 'Sem II Physics Cycle Office Register',
  name: 'Sem II Physics Cycle Office Register',
  semester: 2,
  cycle: 'physics',
  scheme: 'HME 2023',
  branchIds: ['IT', 'AIML', 'EXTC', 'ECS', 'MECH', 'MME'],
  courseOrder: FE_SEM2_PHYSICS_COURSES,
  nonCreditSubjects: nonCreditSubjects('IT', 2),
  verificationStatus: 'from-index-html',
  sourceNote: 'Source: old GitHub calculator / index.html. Sem II reuses Physics cycle template.',
  subjectLayoutName: 'sem2-physics-subject-template',
})
FE_SEM2_PHYSICS_TEMPLATE.subjects = withCourseMetadata(
  creditSubjects('IT', 2),
  FE_SEM2_PHYSICS_TEMPLATE.courseOrder,
  FE_SEM2_PHYSICS_TEMPLATE.sourceNote,
  'from-index-html',
)

// Sem II Chemistry template: used by physics-cycle branches (COMP, AIDS, etc.) in Sem II
const FE_SEM2_CHEMISTRY_COURSES = [
  { roman: 'I', expectedName: 'Chemistry', subjectCode: 'BSC1201' },
  { roman: 'II', expectedName: 'Mathematics-I', subjectCode: 'BSC1202' },
  { roman: 'III', expectedName: 'Programming for Problem Solving', subjectCode: 'ESC1201' },
  { roman: 'IV', expectedName: 'Engineering Mechanics', subjectCode: 'ESC1202' },
  { roman: 'V', expectedName: 'Workshop & Manufacturing Practices-I', subjectCode: 'ESC1203' },
  { roman: 'VI', expectedName: 'Introduction to Indian Knowledge System', subjectCode: 'HSMC1201' },
  { roman: 'VII', expectedName: 'Professional Skills-I (Object Oriented Programming)', subjectCode: 'HME-PS1201' },
  { roman: 'VIII', expectedName: 'Attitude & Aptitude Development-1', subjectCode: 'MC1201', nonCredit: true },
]

export const FE_SEM2_CHEMISTRY_TEMPLATE = createTemplate({
  templateId: 'FE_SEM2_CHEMISTRY_TEMPLATE',
  key: 'sem2-chemistry-office-register',
  aliases: ['sem2-chemistry-pattern', 'sem2-chemistry-subject-template'],
  label: 'Sem II Chemistry Cycle Office Register',
  name: 'Sem II Chemistry Cycle Office Register',
  semester: 2,
  cycle: 'chemistry',
  scheme: 'HME 2023',
  branchIds: ['AIDS', 'COMP', 'CIVIL', 'IOT', 'CSE'],
  courseOrder: FE_SEM2_CHEMISTRY_COURSES,
  nonCreditSubjects: nonCreditSubjects('AIDS', 2),
  verificationStatus: 'from-index-html',
  sourceNote: 'Source: old GitHub calculator / index.html. Sem II reuses Chemistry cycle template.',
  subjectLayoutName: 'sem2-chemistry-subject-template',
})
FE_SEM2_CHEMISTRY_TEMPLATE.subjects = withCourseMetadata(
  creditSubjects('AIDS', 2),
  FE_SEM2_CHEMISTRY_COURSES,
  FE_SEM2_CHEMISTRY_TEMPLATE.sourceNote,
  'from-index-html',
)

export const OFFICE_REGISTER_TEMPLATES = [
  FE_SEM1_PHYSICS_CYCLE,
  FE_SEM1_CHEMISTRY_CYCLE,
  FE_SEM2_PHYSICS_TEMPLATE,
  FE_SEM2_CHEMISTRY_TEMPLATE,
]

export function getOfficeRegisterTemplate(templateKey) {
  return OFFICE_REGISTER_TEMPLATES.find(
    (template) => template.key === templateKey || template.templateId === templateKey || template.aliases?.includes(templateKey),
  ) ?? null
}
