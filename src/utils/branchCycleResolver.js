import { BRANCHES } from './semesterData'
import { OFFICE_REGISTER_TEMPLATES, getOfficeRegisterTemplate } from './officeRegisterTemplates'

const BRANCH_ALIASES = {
  AIDS: ['AIDS', 'A I D S', 'AI&DS', 'AI AND DS', 'AI DS', 'ARTIFICIAL INTELLIGENCE AND DATA SCIENCE', 'ARTIFICIAL INTELLIGENCE & DATA SCIENCE'],
  AIML: ['AIML', 'AI&ML', 'AI AND ML', 'AI ML', 'ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING', 'ARTIFICIAL INTELLIGENCE & MACHINE LEARNING'],
  IT: ['IT', 'INFORMATION TECHNOLOGY'],
  COMP: ['COMP', 'COMPUTER', 'COMPUTER ENGINEERING'],
  CIVIL: ['CIVIL', 'CIVIL ENGINEERING'],
  EXTC: ['EXTC', 'E&TC', 'E AND TC', 'ELECTRONICS AND TELECOMMUNICATION', 'ELECTRONICS & TELECOMMUNICATION'],
  ECS: ['ECS', 'E&CS', 'E AND CS', 'ELECTRONICS AND COMPUTER SCIENCE', 'ELECTRONICS & COMPUTER SCIENCE'],
  MECH: ['MECH', 'MECHANICAL', 'MECHANICAL ENGINEERING'],
  MME: ['MME', 'M&ME', 'M AND ME', 'MECHANICAL AND MECHATRONICS ENGINEERING', 'MECHANICAL AND MECHATRONICS', 'MECHANICAL & MECHATRONICS'],
  IOT: ['IOT', 'CSE-IOT', 'CSE IOT', 'COMPUTER SCIENCE AND ENGINEERING IOT', 'COMPUTER SCIENCE AND ENGINEERING INTERNET OF THINGS', 'INTERNET OF THINGS'],
  CSE: ['CSE-CS', 'CSE CS', 'CSE CYBER SECURITY', 'CYBER SECURITY', 'COMPUTER SCIENCE AND ENGINEERING CYBER SECURITY'],
}

export function normalizeBranch(branch) {
  if (!branch) return null
  const upper = String(branch).toUpperCase().replace(/[^A-Z0-9& -]/g, ' ').replace(/\s+/g, ' ').trim()

  for (const [branchId, aliases] of Object.entries(BRANCH_ALIASES)) {
    if (aliases.some((alias) => (alias.length <= 3 ? new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(upper) : upper.includes(alias)))) {
      return branchId
    }
  }

  return BRANCHES.find((item) => upper.includes(item.id) || upper.includes(item.label.toUpperCase()))?.id ?? null
}

export function normalizeSemester(input) {
  if (input === null || input === undefined || input === '') return null
  const raw = String(input).trim().toUpperCase()
  if (raw === 'I' || raw === 'SEM I' || raw === 'SEMESTER I') return 1
  if (raw === 'II' || raw === 'SEM II' || raw === 'SEMESTER II') return 2
  const match = raw.match(/\b([1-8])\b/)
  return match ? Number(match[1]) : null
}

export function normalizeScheme(input) {
  if (!input) return null
  const upper = String(input).toUpperCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  const hme = upper.match(/HME\s*20\d{2}/)
  return hme ? hme[0].replace(/\s+/g, ' ') : upper
}

export function getAvailableTemplates({ branch, semester } = {}) {
  const branchId = normalizeBranch(branch)
  const semesterNum = normalizeSemester(semester)

  return OFFICE_REGISTER_TEMPLATES.filter((template) => {
    const branchMatches = !branchId || template.branchIds.includes(branchId)
    const semesterMatches = !semesterNum || template.semester === semesterNum
    return branchMatches && semesterMatches
  })
}

export function getTemplateWarnings(template) {
  const warnings = []
  if (!template) return ['No template selected.']
  if (template.verificationStatus === 'needs-verification') {
    warnings.push('Template needs verification against a real gazette or official scheme.')
  }
  if (!template.subjects?.length) {
    warnings.push('Template has no verified subject rows yet.')
  }
  return warnings
}

export function resolveTemplate({ branch, semester, cycle, templateKey } = {}) {
  const branchId = normalizeBranch(branch)
  const semesterNum = normalizeSemester(semester)
  let key = templateKey

  if (!key) {
    if (semesterNum === 1 && cycle === 'physics') key = 'sem1-physics-office-register'
    if (semesterNum === 1 && cycle === 'chemistry') key = 'sem1-chemistry-office-register'
    if (semesterNum === 2 && cycle === 'physics') key = 'sem2-physics-office-register'
    if (semesterNum === 2 && cycle === 'chemistry') key = 'sem2-chemistry-office-register'
  }

  const template = getOfficeRegisterTemplate(key)
  return {
    templateKey: key ?? null,
    template,
    confidence: template ? (template.verificationStatus === 'needs-verification' ? 0.55 : 0.92) : 0.35,
    warnings: getTemplateWarnings(template),
    branch: branchId,
    semester: semesterNum,
  }
}

export function resolveCycle({ branch, semester, cycle: overrideCycle, templateKey: overrideTemplateKey, override = {} } = {}) {
  const warnings = []
  const branchId = normalizeBranch(override.branch ?? branch)
  const semesterNum = normalizeSemester(override.semester ?? semester)
  const manualCycle = override.cycle ?? overrideCycle
  const manualTemplateKey = override.templateKey ?? overrideTemplateKey

  if (!branchId) {
    return {
      branch: branch ?? null,
      normalizedBranch: null,
      cycle: manualCycle ?? null,
      templateKey: manualTemplateKey ?? null,
      subjects: [],
      confidence: 0,
      warnings: ['Could not confidently detect branch from PDF header.'],
      branchId: null,
      semester: semesterNum,
      template: null,
    }
  }

  const semOneCycle = BRANCHES.find((item) => item.id === branchId)?.cycle ?? null
  let cycle = semOneCycle

  if (semesterNum === 2 && semOneCycle) {
    cycle = semOneCycle === 'physics' ? 'chemistry' : 'physics'
    warnings.push('Sem II cycle was inferred from the branch reversal rule and may need verification.')
  }

  if (manualCycle) {
    cycle = manualCycle
    warnings.push('Manual cycle override is active.')
  }

  const resolvedTemplate = resolveTemplate({ branch: branchId, semester: semesterNum, cycle, templateKey: manualTemplateKey })
  const template = resolvedTemplate.template
  const templateKey = resolvedTemplate.templateKey

  if (!template) {
    warnings.push('No office register template was found for the detected branch/cycle.')
  }

  warnings.push(...getTemplateWarnings(template))

  return {
    branch: branchId,
    normalizedBranch: branchId,
    cycle,
    templateKey,
    subjects: template?.subjects ?? [],
    confidence: template ? (template.verificationStatus === 'needs-verification' ? 0.55 : 0.92) : 0.35,
    warnings: Array.from(new Set(warnings)),
    branchId,
    semester: semesterNum,
    template,
  }
}
