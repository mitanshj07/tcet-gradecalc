import { useState } from 'react'
import { AlertTriangle, ChevronDown, RotateCcw } from 'lucide-react'
import { useMarks } from '../hooks/useMarks'
import { computeIA, computeSubjectResult, validateMark } from '../utils/grading'
import GradePill from './GradePill'

const markFields = {
  theory: [
    { key: 'importedIA', label: 'Official IA', max: 40, placeholder: 'Optional' },
    { key: 'ise1', label: 'ISE1', max: 20 },
    { key: 'ise2', label: 'ISE2', max: 20 },
    { key: 'ise3', label: 'ISE3 / IE', max: 20, placeholder: '16' },
    { key: 'ese', label: 'ESE', max: 60 },
  ],
  practical: [
    { key: 'tw', label: 'TW' },
    { key: 'pr', label: 'PR' },
  ],
}

export default function SubjectCard({ subject, initiallyOpen = false }) {
  const [open, setOpen] = useState(initiallyOpen)
  const { marks, updateMark, clearSubject } = useMarks(subject.code)
  const result = computeSubjectResult(subject, marks)
  const ia = computeIA(marks.ise1, marks.ise2, marks.ise3, marks.importedIA)
  const usingImportedIA = marks.importedIA !== '' && marks.importedIA !== null && marks.importedIA !== undefined
  const cardTone = result.failures.length
    ? 'border-red-500/40 bg-red-500/[0.06]'
    : result.completed
      ? 'border-emerald-500/30 bg-emerald-500/[0.045]'
      : 'border-white/10 bg-slate-900/70'

  return (
    <article className={`rounded-xl border ${cardTone}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs font-semibold text-amber-300">{subject.code}</p>
            {subject.courseRoman && <span className="badge-muted">Course {subject.courseRoman}</span>}
            {subject.nonCredit ? <span className="badge-muted">Non-credit</span> : <CreditBadges subject={subject} />}
            {subject.verificationStatus && <span className="badge-muted">{subject.verificationStatus}</span>}
          </div>
          <h3 className="mt-2 truncate text-base font-semibold text-white">{subject.name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {result.theory && <GradePill grade={result.theory.grade} label={`TH ${result.theory.grade}`} />}
          {result.practical && <GradePill grade={result.practical.grade} label={`PR ${result.practical.grade}`} />}
          {result.failures.length > 0 && <span className="status-pill status-danger">ATKT</span>}
          <ChevronDown className={`size-5 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-white/10 p-4">
          {subject.nonCredit ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
              Mandatory course, excluded from SGPA.
            </div>
          ) : (
            <>
              {subject.hasTh && subject.thCr > 0 && (
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Theory</p>
                    <p className="font-mono text-xs text-slate-300">
                      {usingImportedIA
                        ? `Official IA override = ${ia}/40`
                        : `IA: max(${marks.ise1 || '0'}, ${marks.ise2 || '0'}) + ${marks.ise3 || '0'} = ${ia}/40`}
                    </p>
                  </div>
                  <div className="input-grid">
                    {markFields.theory.map((field) => (
                      <MarkInput
                        key={field.key}
                        field={field}
                        max={field.max}
                        subject={subject}
                        value={marks[field.key] ?? ''}
                        updateMark={updateMark}
                      />
                    ))}
                  </div>
                  <HeadStatus result={result.theory} emptyLabel="Theory pending" />
                  {usingImportedIA && (
                    <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-sm text-sky-100">
                      Imported IA from gazette is being used for official calculation. Manual ISE fields are kept separate.
                    </div>
                  )}
                </section>
              )}

              {(subject.hasTW || subject.hasPR) && subject.practicalCr > 0 && (
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{subject.twOnly ? 'Term work' : 'Practical'}</p>
                    <p className="font-mono text-xs text-slate-300">{subject.practicalCr} credit{subject.practicalCr > 1 ? 's' : ''}</p>
                  </div>
                  <div className="input-grid">
                    {markFields.practical
                      .filter((field) => (field.key === 'tw' ? subject.hasTW : subject.hasPR))
                      .map((field) => (
                        <MarkInput
                          key={field.key}
                          field={{ ...field, label: field.key === 'tw' ? subject.twLabel ?? field.label : field.label }}
                          max={field.key === 'tw' ? subject.twMax ?? 25 : subject.prMax ?? 25}
                          subject={subject}
                          value={marks[field.key] ?? ''}
                          updateMark={updateMark}
                        />
                      ))}
                  </div>
                  <HeadStatus result={result.practical} emptyLabel="Practical pending" />
                </section>
              )}

              <div className="flex justify-end">
                <button type="button" className="ghost-button" onClick={clearSubject}>
                  <RotateCcw className="size-4" />
                  Clear
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  )
}

function CreditBadges({ subject }) {
  const practicalLabel = subject.hasTW && subject.hasPR ? 'TW/PR' : subject.hasTW ? 'TW' : 'PR'

  return (
    <>
      {subject.thCr > 0 && <span className="badge-muted">TH {subject.thCr} cr</span>}
      {subject.practicalCr > 0 && <span className="badge-muted">{practicalLabel} {subject.practicalCr} cr</span>}
    </>
  )
}

function MarkInput({ field, max, subject, value, updateMark }) {
  const error = validateMark(subject, field.key, value)

  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-300">
        <span>{field.label}</span>
        <span className="font-mono text-slate-500">/{max}</span>
      </span>
      <input
        className={`mark-input ${error ? 'border-red-400/70 bg-red-500/10' : ''}`}
        inputMode="decimal"
        max={max}
        min="0"
        placeholder={field.placeholder ?? '0'}
        step="0.5"
        type="number"
        value={value}
        onChange={(event) => updateMark(field.key, event.target.value)}
      />
      {error && <span className="mt-1 block text-xs text-red-300">{error}</span>}
    </label>
  )
}

function HeadStatus({ result, emptyLabel }) {
  if (!result) {
    return <p className="text-xs text-slate-500">{emptyLabel}</p>
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 ${result.passing ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
      {!result.passing && <AlertTriangle className="size-4 text-red-300" />}
      <span className="font-mono text-sm font-semibold text-white">{result.pct.toFixed(1)}%</span>
      <GradePill grade={result.grade} />
      <span className="text-xs text-slate-300">GP {result.gp}</span>
      {!result.passing && <span className="status-pill status-danger">ATKT</span>}
    </div>
  )
}
