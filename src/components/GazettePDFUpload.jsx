import { useMemo, useState } from 'react'
import { FileSearch, LoaderCircle, ShieldCheck, Upload, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useStore } from '../store/useStore'
import { BRANCHES } from '../utils/semesterData'
import { extractPdfText } from '../utils/pdfExtract'
import { looksLikeTcetGazette, parseTcetGazetteText } from '../utils/tcetGazetteParser'
import { OFFICE_REGISTER_TEMPLATES } from '../utils/officeRegisterTemplates'

const PHASES = {
  idle: 'Idle',
  validating: 'Validating file',
  reading: 'Reading PDF',
  extracting: 'Extracting text',
  detecting: 'Detecting branch/semester/cycle',
  mapping: 'Parsing course map',
  parsing: 'Parsing marks',
  validatingGpa: 'Validating GPA',
  review: 'Review parsed result',
  applied: 'Applied successfully',
  failed: 'Failed/manual entry needed',
}

export default function GazettePDFUpload({ branch, semester }) {
  const applyParsedResult = useStore((state) => state.applyParsedResult)
  const saveCurrentResult = useStore((state) => state.saveCurrentResult)
  const { user } = useAuth()
  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState(null)
  const [fileName, setFileName] = useState('')
  const [savingOfficial, setSavingOfficial] = useState(false)
  const [rawText, setRawText] = useState('')
  const [overrideBranch, setOverrideBranch] = useState(branch)
  const [overrideSemester, setOverrideSemester] = useState(String(semester))
  const [overrideCycle, setOverrideCycle] = useState('')
  const [overrideTemplateKey, setOverrideTemplateKey] = useState('')

  const summaryTone = useMemo(() => {
    if (!parsed) return 'status-muted'
    if (parsed.confidence >= 0.85) return 'status-success'
    if (parsed.confidence >= 0.6) return 'status-warning'
    return 'status-danger'
  }, [parsed])

  async function parseFile(file) {
    if (!file) return

    setError('')
    setParsed(null)
    setFileName(file.name)

    try {
      setPhase('validating')
      if (file.type !== 'application/pdf') {
        throw new Error('Please choose a PDF file.')
      }
      setPhase('reading')
      const extraction = await extractPdfText(file)
      setRawText(extraction.text)
      setPhase('extracting')

      if (!looksLikeTcetGazette(extraction.text)) {
        throw new Error('Could not detect a TCET-style gazette/result layout in this PDF.')
      }

      setPhase('detecting')
      await Promise.resolve()
      setPhase('mapping')
      await Promise.resolve()
      setPhase('parsing')
      const nextParsed = parseTcetGazetteText(extraction.text, branch, semester)
      setPhase('validatingGpa')
      setParsed(nextParsed)
      setOverrideBranch(nextParsed.metadata?.branch ?? nextParsed.student.branch ?? branch)
      setOverrideSemester(String(nextParsed.metadata?.semester ?? nextParsed.student.semester ?? semester))
      setOverrideCycle(nextParsed.metadata?.cycle ?? '')
      setOverrideTemplateKey(nextParsed.metadata?.templateKey ?? '')
      setPhase('review')
    } catch (nextError) {
      setError(nextError.message ?? 'Could not parse this PDF.')
      setPhase('failed')
    }
  }

  async function handleFileChange(event) {
    try {
      await parseFile(event.target.files?.[0])
    } finally {
      event.target.value = ''
    }
  }

  function handleDrop(event) {
    event.preventDefault()
    parseFile(event.dataTransfer.files?.[0])
  }

  function rerunWithOverrides() {
    if (!rawText) return
    const nextParsed = parseTcetGazetteText(rawText, branch, semester, {
      branch: overrideBranch,
      semester: Number(overrideSemester),
      cycle: overrideCycle || undefined,
      templateKey: overrideTemplateKey || undefined,
    })
    setParsed(nextParsed)
    setPhase('review')
  }

  function buildMarksByCode(parsedResult) {
    return parsedResult.subjects.reduce((acc, subject) => {
      acc[subject.subjectCode] = {
        importedIA: subject.importedIA === undefined ? '' : String(subject.importedIA),
        ese: subject.ese === undefined ? '' : String(subject.ese),
        tw: subject.tw === undefined ? '' : String(subject.tw),
        pr: subject.pr === undefined ? '' : String(subject.pr),
        oral: subject.oral === undefined ? '' : String(subject.oral),
      }
      return acc
    }, {})
  }

  function applyResult(manualMode = false) {
    if (!parsed) return
    applyParsedResult({
      branch: parsed.student.branch ?? branch,
      semester: parsed.student.semester ?? semester,
      marksByCode: buildMarksByCode(parsed),
      profileUpdates: {
        name: parsed.student.name || undefined,
        rollNo: parsed.student.seatNo || undefined,
      },
    })
    setPhase('applied')
    if (manualMode) {
      setError('Parsed values were copied into the calculator. Review and adjust low-confidence fields manually.')
    }
  }

  async function handleSaveOfficial() {
    if (!parsed) return
    setSavingOfficial(true)
    setError('')

    try {
      const marksByCode = buildMarksByCode(parsed)
      const subjectMetadataByCode = Object.fromEntries(
        parsed.subjects.map((subject) => [
          subject.subjectCode,
          {
            parseConfidence: subject.confidence,
            rawSubjectLine: subject.rawSubjectLine,
            source: 'pdf',
            courseRoman: subject.courseRoman,
            componentType: subject.componentType,
            parsedOfficialCredits: subject.parsedOfficialCredits,
            templateCreditsUsed: subject.templateCreditsUsed,
          },
        ]),
      )

      applyParsedResult({
        branch: parsed.student.branch ?? branch,
        semester: parsed.student.semester ?? semester,
        marksByCode,
        profileUpdates: {
          name: parsed.student.name || undefined,
          rollNo: parsed.student.seatNo || undefined,
        },
      })

      await saveCurrentResult({
        user,
        official: true,
        locked: true,
        source: 'pdf',
        parserConfidence: parsed.confidence,
        uploadedPdfName: fileName,
        officialSgpa: parsed.final.sgpa ?? null,
        marksOverride: marksByCode,
        subjectMetadataByCode,
      })

      setPhase('applied')
    } catch (nextError) {
      setError(nextError.message ?? 'Could not save this official result.')
    } finally {
      setSavingOfficial(false)
    }
  }

  return (
    <section className="surface-panel p-4" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-kicker">PDF Import</p>
          <h3 className="panel-title">Upload Gazette / Result PDF</h3>
          <p className="mt-2 text-sm text-slate-300">
            Your PDF is parsed locally in your browser. The file is not uploaded. Only confirmed marks are saved.
          </p>
        </div>
        <label className="primary-button cursor-pointer">
          <Upload className="size-4" />
          Upload PDF
          <input accept="application/pdf" className="hidden" type="file" onChange={handleFileChange} />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-300">
        <span className="status-pill status-info">{PHASES[phase]}</span>
        <span>Drop a text-based PDF here or choose one. Max 5MB, max 5 pages.</span>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      {['validating', 'reading', 'extracting', 'detecting', 'mapping', 'parsing', 'validatingGpa'].includes(phase) && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
          <LoaderCircle className="size-4 animate-spin" />
          {PHASES[phase]}
        </div>
      )}

      {parsed && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`status-pill ${summaryTone}`}>Confidence {Math.round(parsed.confidence * 100)}%</span>
                {parsed.final.sgpa !== undefined && (
                  <span className="status-pill status-muted">Official SGPA {parsed.final.sgpa?.toFixed?.(2) ?? parsed.final.sgpa}</span>
                )}
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <Info label="Format" value={parsed.format || '--'} />
                <Info label="Student" value={parsed.student.name || '--'} />
                <Info label="Seat no" value={parsed.student.seatNo || '--'} />
                <Info label="Branch" value={parsed.student.branch || branch} />
                <Info label="Semester" value={String(parsed.student.semester || semester)} />
                <Info label="Cycle" value={parsed.metadata?.cycle || '--'} />
                <Info label="Template" value={parsed.template?.label || parsed.metadata?.templateKey || '--'} />
                <Info label="Template status" value={parsed.template?.verificationStatus || '--'} />
                <Info label="Exam" value={parsed.student.examMonthYear || '--'} />
                <Info label="Report date" value={parsed.metadata?.reportDate || '--'} />
                <Info label="Sigma C" value={String(parsed.final.totalCredits ?? '--')} />
                <Info label="Sigma CG" value={String(parsed.final.totalCreditPoints ?? '--')} />
                <Info label="Status" value={parsed.final.status || 'UNKNOWN'} />
              </dl>
              {parsed.metadata?.detectionMessage && (
                <div className="mt-4 rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-sm text-sky-100">
                  {parsed.metadata.detectionMessage}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 text-emerald-300" />
                <div>
                  <p className="font-semibold text-white">Review before saving</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Low-confidence fields stay editable. Apply to the calculator first if you want to adjust anything.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <label>
                  <span className="input-label">Manual branch override</span>
                  <select className="select-input" value={overrideBranch} onChange={(event) => setOverrideBranch(event.target.value)}>
                    {BRANCHES.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label>
                    <span className="input-label">Semester</span>
                    <select className="select-input" value={overrideSemester} onChange={(event) => setOverrideSemester(event.target.value)}>
                      <option value="1">Sem I</option>
                      <option value="2">Sem II</option>
                    </select>
                  </label>
                  <label>
                    <span className="input-label">Cycle</span>
                    <select className="select-input" value={overrideCycle} onChange={(event) => setOverrideCycle(event.target.value)}>
                      <option value="">Auto</option>
                      <option value="physics">Physics</option>
                      <option value="chemistry">Chemistry</option>
                    </select>
                  </label>
                  <label>
                    <span className="input-label">Template</span>
                    <select className="select-input" value={overrideTemplateKey} onChange={(event) => setOverrideTemplateKey(event.target.value)}>
                      <option value="">Auto</option>
                      {OFFICE_REGISTER_TEMPLATES.map((template) => (
                        <option key={template.key} value={template.key}>
                          {template.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button type="button" className="secondary-button w-full" onClick={rerunWithOverrides}>
                  Re-run with selected template
                </button>
              </div>
              {!!parsed.warnings.length && (
                <div className="mt-4 space-y-2">
                  {parsed.warnings.map((warning) => (
                    <div key={warning} className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/10">
            <table className="data-table min-w-[920px]">
              <thead>
                <tr>
                  <th>Course / Subject</th>
                  <th>Component</th>
                  <th>IA</th>
                  <th>ESE</th>
                  <th>TW</th>
                  <th>PR/OR</th>
                  <th>Total</th>
                  <th>Template Credits Used</th>
                  <th>Parsed Credits From PDF</th>
                  <th>Grade</th>
                  <th>GP</th>
                  <th>CP</th>
                  <th>Confidence</th>
                  <th>Warnings</th>
                </tr>
              </thead>
              <tbody>
                {parsed.subjects.map((subject) => (
                  <tr key={subject.subjectCode}>
                    <td>
                      <div>
                        <p className="text-xs text-slate-400">COURSE {subject.courseRoman ?? '--'}</p>
                        <p className="font-semibold text-white">{subject.subjectCode}</p>
                        <p className="text-xs text-slate-400">{subject.subjectName || '--'}</p>
                      </div>
                    </td>
                    <td>{subject.componentType ?? '--'}</td>
                    <td>
                      {subject.importedIA ?? '--'}
                      {subject.importedIA !== undefined && <span className="mt-1 block text-xs text-slate-400">Imported IA from gazette</span>}
                    </td>
                    <td>{subject.ese ?? '--'}</td>
                    <td>{subject.tw ?? '--'}</td>
                    <td>{subject.pr ?? subject.oral ?? '--'}</td>
                    <td>{subject.total ?? subject.theoryTotal ?? subject.practicalTotal ?? '--'}</td>
                    <td>{subject.templateCreditsUsed ?? subject.credits ?? '--'}</td>
                    <td>{subject.parsedOfficialCredits ?? '--'}</td>
                    <td>{subject.grade ?? '--'}</td>
                    <td>{subject.gradePoint ?? '--'}</td>
                    <td>{subject.creditPoints ?? '--'}</td>
                    <td>
                      <span className={`status-pill ${subject.confidence >= 0.8 ? 'status-success' : subject.confidence >= 0.6 ? 'status-warning' : 'status-danger'}`}>
                        {Math.round(subject.confidence * 100)}%
                      </span>
                    </td>
                    <td className="text-xs text-slate-400">{subject.warnings?.[0] ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Detected template</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p>Branch: {parsed.metadata?.branch || '--'}</p>
                <p>Semester: {parsed.metadata?.semester || '--'}</p>
                <p>Cycle: {parsed.metadata?.cycle || '--'}</p>
                <p>Template: {parsed.template?.label || parsed.metadata?.templateKey || '--'}</p>
                <p>Verification: {parsed.template?.verificationStatus || '--'}</p>
                <p>Scheme: {parsed.metadata?.scheme || '--'}</p>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">Course map from PDF</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {Object.entries(parsed.courseMap || {}).length ? (
                  Object.entries(parsed.courseMap).map(([roman, label]) => (
                    <p key={roman}>
                      COURSE {roman}: {label}
                    </p>
                  ))
                ) : (
                  <p>No COURSE I / II / III headers detected.</p>
                )}
              </div>
            </div>
          </div>

          <details className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <summary className="cursor-pointer list-none font-semibold text-white">Raw text preview</summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-slate-300">{parsed.rawTextPreview}</pre>
          </details>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="primary-button" onClick={() => applyResult(false)}>
              <FileSearch className="size-4" />
              Apply to Calculator
            </button>
            <button type="button" className="secondary-button" onClick={() => applyResult(true)}>
              Edit Manually
            </button>
            <button type="button" className="ghost-button" onClick={() => applyResult(true)}>
              Manually split IA into ISE1/ISE2/ISE3
            </button>
            {user && (
              <button type="button" className="secondary-button" disabled={savingOfficial} onClick={handleSaveOfficial}>
                {savingOfficial ? 'Saving official result' : 'Save as Official Result'}
              </button>
            )}
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setParsed(null)
                setPhase('idle')
                setError('')
              }}
            >
              <X className="size-4" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-normal text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
