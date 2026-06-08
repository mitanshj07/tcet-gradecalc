import { useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { useStore } from '../store/useStore'
import { BRANCHES, getRawSubjectRows } from '../utils/semesterData'
import { resolveCycle } from '../utils/branchCycleResolver'

const VERIFICATION_OPTIONS = ['all', 'verified-from-gazette', 'official-scheme', 'from-index-html', 'from-existing-repo', 'needs-verification']

export default function DebugSubjects() {
  const activeBranch = useStore((state) => state.branch)
  const activeSemester = useStore((state) => state.semester)
  const [branch, setBranch] = useState(activeBranch)
  const [semester, setSemester] = useState(String(activeSemester))
  const [cycle, setCycle] = useState('all')
  const [verificationStatus, setVerificationStatus] = useState('all')
  const resolved = resolveCycle({ branch, semester })
  const subjects = useMemo(() => {
    return getRawSubjectRows(branch, Number(semester)).filter((subject) => {
      const cycleMatches = cycle === 'all' || subject.cycle === cycle
      const verificationMatches = verificationStatus === 'all' || subject.verificationStatus === verificationStatus
      return cycleMatches && verificationMatches
    })
  }, [branch, cycle, semester, verificationStatus])

  const totals = subjects.reduce(
    (acc, subject) => {
      if (subject.isNonCredit) acc.nonCredit += 1
      acc.theory += subject.theoryCredits
      acc.practical += subject.practicalCredits
      acc.total += subject.totalCredits
      return acc
    },
    { theory: 0, practical: 0, total: 0, nonCredit: 0 },
  )

  async function copyJSON(value) {
    await navigator.clipboard?.writeText(JSON.stringify(value, null, 2))
  }

  return (
    <div className="space-y-5">
      <div className="page-heading">
        <div>
          <p className="section-kicker">Debug</p>
          <h1>Subject Verification Grid</h1>
          <p>Use this page to verify branch, semester, credits, max marks, grading mode, parser hints, and verification status.</p>
        </div>
      </div>

      <section className="surface-panel p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="input-label">Branch</span>
            <select className="select-input" value={branch} onChange={(event) => setBranch(event.target.value)}>
              {BRANCHES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="input-label">Semester</span>
            <select className="select-input" value={semester} onChange={(event) => setSemester(event.target.value)}>
              <option value="1">Sem I</option>
              <option value="2">Sem II</option>
            </select>
          </label>
          <label>
            <span className="input-label">Cycle</span>
            <select className="select-input" value={cycle} onChange={(event) => setCycle(event.target.value)}>
              <option value="all">All cycles</option>
              <option value="physics">Physics</option>
              <option value="chemistry">Chemistry</option>
            </select>
          </label>
          <label>
            <span className="input-label">Verification</span>
            <select className="select-input" value={verificationStatus} onChange={(event) => setVerificationStatus(event.target.value)}>
              {VERIFICATION_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-4">
        <Metric label="Theory credits" value={totals.theory} />
        <Metric label="Practical credits" value={totals.practical} />
        <Metric label="Academic credits" value={totals.total} />
        <Metric label="Non-credit courses" value={totals.nonCredit} />
      </section>

      <section className="surface-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Resolved Template</p>
            <h2 className="panel-title">{resolved.template?.label ?? 'No template'}</h2>
            <p className="mt-1 text-sm text-slate-300">
              {resolved.normalizedBranch ?? branch} / Sem {resolved.semester ?? semester} / {resolved.cycle ?? 'unknown cycle'}
            </p>
            <p className="mt-1 text-xs text-slate-400">Parser confidence: {Math.round((resolved.confidence ?? 0) * 100)}%</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="secondary-button" onClick={() => copyJSON(subjects)}>
              <Copy className="size-4" />
              Subject JSON
            </button>
            <button type="button" className="secondary-button" onClick={() => copyJSON(resolved.template)}>
              <Copy className="size-4" />
              Template JSON
            </button>
          </div>
        </div>
        {!!resolved.warnings.length && (
          <div className="mt-3 space-y-2">
            {resolved.warnings.map((warning) => (
              <div key={warning} className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                {warning}
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
          <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2">
            Credits source: index.html / current subject catalog
          </div>
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2">
            Course map source: gazette template resolver
          </div>
        </div>
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1560px]">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Semester</th>
                <th>Cycle</th>
                <th>Course</th>
                <th>Code</th>
                <th>Name</th>
                <th>TH cr</th>
                <th>PR cr</th>
                <th>Total cr</th>
                <th>TH</th>
                <th>TW</th>
                <th>PR/OR</th>
                <th>Max marks</th>
                <th>Mode</th>
                <th>Verification</th>
                <th>Credits source</th>
                <th>Source note</th>
                <th>Parser hints</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr key={subject.id}>
                  <td>{branch}</td>
                  <td>{subject.semester}</td>
                  <td>{subject.cycle}</td>
                  <td>{subject.courseRoman ?? '--'}</td>
                  <td className="font-mono text-white">{subject.code}</td>
                  <td>{subject.name}</td>
                  <td>{subject.theoryCredits}</td>
                  <td>{subject.practicalCredits}</td>
                  <td>{subject.totalCredits}</td>
                  <td>{subject.hasTheory ? 'Yes' : 'No'}</td>
                  <td>{subject.hasTW ? 'Yes' : 'No'}</td>
                  <td>{subject.hasPR || subject.hasOR ? 'Yes' : 'No'}</td>
                  <td className="font-mono text-xs">{JSON.stringify(subject.maxMarks)}</td>
                  <td>{subject.gradingMode}</td>
                  <td>{subject.verificationStatus}</td>
                  <td>{subject.verificationStatus === 'verified-from-gazette' ? 'index.html credits + gazette course map' : 'index.html/current repo'}</td>
                  <td>{subject.sourceNote}</td>
                  <td className="font-mono text-xs">{JSON.stringify(subject.parserHints)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="surface-panel p-4">
      <p className="text-xs uppercase tracking-normal text-slate-400">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold text-white">{value}</p>
    </div>
  )
}
