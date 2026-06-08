import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Save } from 'lucide-react'
import GradeDistribution from '../components/Charts/GradeDistribution'
import TheoryVsPractical from '../components/Charts/TheoryVsPractical'
import ResultCard from '../components/ResultCard'
import TargetCalculator from '../components/TargetCalculator'
import { useSGPA } from '../hooks/useSGPA'
import { useStore } from '../store/useStore'
import { formatSGPA } from '../utils/format'
import {
  calculateSemester,
  classifySGPA,
  computeSubjectResult,
  hasAnyEnteredMarks,
  neededSGPA,
  rankSubjectImpacts,
  sgpaToPercentage,
  subjectStatus,
} from '../utils/grading'

export default function Analysis() {
  const summary = useSGPA()
  const marks = useStore((state) => state.marks)
  const profile = useStore((state) => state.profile)
  const saveCurrentResult = useStore((state) => state.saveCurrentResult)
  const hasMarks = hasAnyEnteredMarks(marks)
  const [saveError, setSaveError] = useState('')
  const classification = classifySGPA(summary.sgpa)
  const percentage = sgpaToPercentage(summary.sgpa)
  const [semOne, setSemOne] = useState(summary.semester === 1 && summary.sgpa ? summary.sgpa.toFixed(2) : '')
  const [semTwo, setSemTwo] = useState(summary.semester === 2 && summary.sgpa ? summary.sgpa.toFixed(2) : '')
  const [targetCGPA, setTargetCGPA] = useState(8)
  const theorySubjects = useMemo(
    () => summary.subjects.filter((subject) => !subject.nonCredit && subject.hasTh && subject.thCr > 0),
    [summary.subjects],
  )
  const [whatIfCode, setWhatIfCode] = useState(theorySubjects[0]?.code ?? '')
  const [whatIfMode, setWhatIfMode] = useState('+5')
  const [customEse, setCustomEse] = useState('')
  const currentForTarget = Number(semOne) || summary.sgpa || 0
  const target = neededSGPA(currentForTarget, targetCGPA)
  const computedCGPA = useMemo(() => {
    const s1 = Number(semOne)
    const s2 = Number(semTwo)
    if (!Number.isFinite(s1) || !Number.isFinite(s2) || !s1 || !s2) return null
    return (s1 + s2) / 2
  }, [semOne, semTwo])
  const whatIfSubject = theorySubjects.find((subject) => subject.code === whatIfCode) ?? theorySubjects[0]
  const whatIfMarks = useMemo(() => marks[whatIfSubject?.code] ?? {}, [marks, whatIfSubject?.code])
  const currentSubjectResult = whatIfSubject ? computeSubjectResult(whatIfSubject, whatIfMarks) : null
  const nextEse = useMemo(() => {
    const currentEse = Number(whatIfMarks.ese || 0)
    if (whatIfMode === 'custom') return Number(customEse || 0)
    if (whatIfMode === '+10') return currentEse + 10
    if (whatIfMode === '-5') return currentEse - 5
    return currentEse + 5
  }, [customEse, whatIfMarks.ese, whatIfMode])
  const whatIfOutcome = useMemo(() => {
    if (!whatIfSubject) return null
    const nextMarks = {
      ...marks,
      [whatIfSubject.code]: {
        ...whatIfMarks,
        ese: String(Math.max(0, Math.min(60, nextEse))),
      },
    }
    const nextSemester = calculateSemester(summary.subjects, nextMarks)
    const nextSubject = computeSubjectResult(whatIfSubject, nextMarks[whatIfSubject.code])
    return {
      nextSemester,
      nextSubject,
      sgpaDiff:
        nextSemester.sgpa === null || summary.sgpa === null ? null : Number((nextSemester.sgpa - summary.sgpa).toFixed(2)),
    }
  }, [marks, nextEse, summary.sgpa, summary.subjects, whatIfMarks, whatIfSubject])
  const impactRows = useMemo(() => rankSubjectImpacts(summary.subjects, marks), [marks, summary.subjects])

  async function handleSaveSnapshot() {
    setSaveError('')

    try {
      await saveCurrentResult()
    } catch (error) {
      setSaveError(error.message ?? 'Could not save this snapshot right now.')
    }
  }

  if (!hasMarks) {
    return (
      <div className="surface-panel mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-2xl font-semibold text-white">No marks entered yet</h1>
        <p className="mt-2 text-slate-300">Open the calculator and complete at least one credit head.</p>
        <Link className="primary-button mt-5 inline-flex" to="/calculator">
          Calculator
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="page-heading">
        <div>
          <p className="section-kicker">Projected Result</p>
          <h1>Analysis</h1>
          <p>
            {summary.branch.label} / Sem {summary.semester}
          </p>
        </div>
        <button type="button" className="primary-button" disabled={!summary.sgpa} onClick={handleSaveSnapshot}>
          <Save className="size-4" />
          Save snapshot
        </button>
      </div>
      {saveError && <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{saveError}</div>}

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="metric-hero lg:col-span-2">
          <p className="section-kicker">Projected SGPA</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <p className="font-mono text-7xl font-semibold text-white">{formatSGPA(summary.sgpa)}</p>
            <span className={`status-pill status-${classification.tone}`}>{classification.label}</span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Conservative" value={formatSGPA(summary.range.conservative)} />
            <Metric label="Optimistic" value={formatSGPA(summary.range.optimistic)} />
            <Metric label="Credits" value={`${summary.earnedCredits}/${summary.totalCredits}`} />
            <Metric label="Percent" value={percentage.low === null ? '--' : `${percentage.low}% - ${percentage.high}%`} />
          </div>
        </div>

        <div className={`surface-panel p-4 lg:col-span-2 ${summary.failures.length ? 'border-red-500/35' : ''}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`mt-1 size-5 ${summary.failures.length ? 'text-red-300' : 'text-emerald-300'}`} />
            <div>
              <p className="panel-title">{summary.failures.length ? 'ATKT warning' : 'Passing heads'}</p>
              <p className="mt-1 text-sm text-slate-300">
                {summary.failures.length ? 'Failing heads are listed below.' : 'No completed credit head is below the pass rule.'}
              </p>
            </div>
          </div>
          {summary.failures.length > 0 && (
            <div className="mt-4 space-y-2">
              {summary.failures.map((failure) => (
                <div key={`${failure.code}-${failure.head}`} className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm">
                  <span className="font-semibold text-red-100">{failure.code}</span>
                  <span className="text-slate-300"> / {failure.head} / {failure.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TheoryVsPractical averages={summary.headAverages} />
        <GradeDistribution data={summary.gradeDistribution} />
      </section>

      <section className="surface-panel overflow-hidden p-0">
        <div className="border-b border-white/10 p-4">
          <p className="section-kicker">Subject Intelligence</p>
          <h3 className="panel-title">Credit heads and status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[920px]">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Theory</th>
                <th>Practical</th>
                <th>Credits</th>
                <th>GP</th>
                <th>Credit Points</th>
                <th>Status</th>
                <th>ATKT</th>
              </tr>
            </thead>
            <tbody>
              {summary.subjectResults
                .filter((result) => !result.nonCredit)
                .map((result) => (
                  <SubjectRow key={result.subject.code} result={result} />
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TargetCalculator subjects={summary.subjects} />
        <CGPAPlanner
          computedCGPA={computedCGPA}
          semOne={semOne}
          semTwo={semTwo}
          setSemOne={setSemOne}
          setSemTwo={setSemTwo}
          setTargetCGPA={setTargetCGPA}
          target={target}
          targetCGPA={targetCGPA}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <WhatIfSimulator
          customEse={customEse}
          currentSubjectResult={currentSubjectResult}
          setCustomEse={setCustomEse}
          setWhatIfCode={setWhatIfCode}
          setWhatIfMode={setWhatIfMode}
          theorySubjects={theorySubjects}
          whatIfCode={whatIfCode}
          whatIfMode={whatIfMode}
          whatIfOutcome={whatIfOutcome}
        />
        <ImpactRanking rows={impactRows} />
      </section>

      <ResultCard summary={summary} profile={profile} branchLabel={summary.branch.label} semester={summary.semester} />
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs uppercase tracking-normal text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-white">{value}</p>
    </div>
  )
}

function SubjectRow({ result }) {
  const gpDisplay = [result.theory?.gp, result.practical?.gp].filter(Number.isFinite).join(' / ') || '--'
  const theoryPct = result.theory ? `${result.theory.pct.toFixed(1)}% (${result.theory.grade})` : '--'
  const practicalPct = result.practical ? `${result.practical.pct.toFixed(1)}% (${result.practical.grade})` : '--'

  return (
    <tr>
      <td>
        <div>
          <p className="font-semibold text-white">{result.subject.name}</p>
          <p className="font-mono text-xs text-slate-400">{result.subject.code}</p>
        </div>
      </td>
      <td>{theoryPct}</td>
      <td>{practicalPct}</td>
      <td className="font-mono">{result.creditsCounted}/{result.totalCredits}</td>
      <td className="font-mono">{gpDisplay}</td>
      <td className="font-mono">{result.creditPoints.toFixed(1)}</td>
      <td>{subjectStatus(result)}</td>
      <td>{result.failures.length ? <span className="status-pill status-danger">Yes</span> : <span className="status-pill status-success">No</span>}</td>
    </tr>
  )
}

function CGPAPlanner({ semOne, semTwo, computedCGPA, setSemOne, setSemTwo, targetCGPA, setTargetCGPA, target }) {
  return (
    <section className="surface-panel p-4">
      <p className="section-kicker">CGPA Planner</p>
      <h3 className="panel-title">FE semester average</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label>
          <span className="input-label">Sem I SGPA</span>
          <input className="mark-input" max="10" min="0" step="0.01" type="number" value={semOne} onChange={(event) => setSemOne(event.target.value)} />
        </label>
        <label>
          <span className="input-label">Sem II SGPA</span>
          <input className="mark-input" max="10" min="0" step="0.01" type="number" value={semTwo} onChange={(event) => setSemTwo(event.target.value)} />
        </label>
      </div>
      <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/45 p-3">
        <span className="text-xs uppercase tracking-normal text-slate-400">CGPA</span>
        <p className="font-mono text-3xl font-semibold text-white">{computedCGPA ? computedCGPA.toFixed(2) : '--'}</p>
      </div>
      <label className="mt-4 block">
        <span className="input-label">Target CGPA: {targetCGPA.toFixed(1)}</span>
        <input
          className="w-full accent-amber-400"
          max="10"
          min="4"
          step="0.1"
          type="range"
          value={targetCGPA}
          onChange={(event) => setTargetCGPA(Number(event.target.value))}
        />
      </label>
      <p className={`mt-3 rounded-lg border p-3 text-sm ${target.possible ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100' : 'border-red-500/25 bg-red-500/10 text-red-100'}`}>
        Required next semester SGPA: {target.perSem === null ? '--' : target.perSem.toFixed(2)}
      </p>
    </section>
  )
}

function WhatIfSimulator({
  theorySubjects,
  whatIfCode,
  setWhatIfCode,
  whatIfMode,
  setWhatIfMode,
  customEse,
  setCustomEse,
  currentSubjectResult,
  whatIfOutcome,
}) {
  return (
    <section className="surface-panel p-4">
      <p className="section-kicker">What-if Simulator</p>
      <h3 className="panel-title">ESE impact by subject</h3>

      <div className="mt-4 grid gap-3">
        <label>
          <span className="input-label">Theory subject</span>
          <select className="select-input" value={whatIfCode} onChange={(event) => setWhatIfCode(event.target.value)}>
            {theorySubjects.map((subject) => (
              <option key={subject.code} value={subject.code}>
                {subject.code} - {subject.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-2 sm:grid-cols-4">
          {['+5', '+10', '-5', 'custom'].map((option) => (
            <button
              key={option}
              type="button"
              className={`segmented-button ${whatIfMode === option ? 'segmented-button-active' : ''}`}
              onClick={() => setWhatIfMode(option)}
            >
              {option === 'custom' ? 'Custom' : option}
            </button>
          ))}
        </div>
        {whatIfMode === 'custom' && (
          <label>
            <span className="input-label">Custom ESE value</span>
            <input className="mark-input" max="60" min="0" step="0.5" type="number" value={customEse} onChange={(event) => setCustomEse(event.target.value)} />
          </label>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Current grade" value={currentSubjectResult?.theory?.grade ?? '--'} />
        <Metric label="New grade" value={whatIfOutcome?.nextSubject?.theory?.grade ?? '--'} />
        <Metric label="SGPA diff" value={whatIfOutcome?.sgpaDiff === null ? '--' : `${whatIfOutcome.sgpaDiff >= 0 ? '+' : ''}${whatIfOutcome.sgpaDiff.toFixed(2)}`} />
      </div>
    </section>
  )
}

function ImpactRanking({ rows }) {
  return (
    <section className="surface-panel overflow-hidden">
      <div className="border-b border-white/10 p-4">
        <p className="section-kicker">SGPA Impact Ranking</p>
        <h3 className="panel-title">Best ESE leverage</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[640px]">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Current Grade</th>
              <th>+5 impact</th>
              <th>+10 impact</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.subjectCode}>
                <td>
                  <div>
                    <p className="font-semibold text-white">{row.subjectCode}</p>
                    <p className="text-xs text-slate-400">{row.subjectName}</p>
                  </div>
                </td>
                <td>{row.currentGrade}</td>
                <td>{formatImpact(row.impacts.plus5?.delta)}</td>
                <td>{formatImpact(row.impacts.plus10?.delta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function formatImpact(value) {
  if (value === null || value === undefined) return '--'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}
