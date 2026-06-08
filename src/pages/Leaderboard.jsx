import { useEffect, useMemo, useState } from 'react'
import { Trophy } from 'lucide-react'
import { supabase } from '../utils/supabase'
import { useStore } from '../store/useStore'
import { BRANCHES } from '../utils/semesterData'
import { maskName } from '../utils/privacy'

export default function Leaderboard() {
  const [branch, setBranch] = useState('AIDS')
  const [semester, setSemester] = useState(1)
  const [batchYear, setBatchYear] = useState('all')
  const [officialOnly, setOfficialOnly] = useState(true)
  const [remoteRows, setRemoteRows] = useState([])
  const profile = useStore((state) => state.profile)
  const history = useStore((state) => state.history)

  useEffect(() => {
    if (!supabase) {
      return
    }

    let cancelled = false

    supabase
      .from('leaderboard')
      .select('masked_name, branch, batch_year, semester, sgpa, rank, is_official')
      .eq('branch', branch)
      .eq('semester', semester)
      .order('rank', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setRemoteRows(data ?? [])
      })

    return () => {
      cancelled = true
    }
  }, [branch, semester])

  const localRows = useMemo(() => {
    if (supabase || !profile.isPublic) return []
    return history
      .filter((item) => item.branch === branch && item.semester === semester)
      .filter((item) => (officialOnly ? item.isOfficial && item.isLocked : true))
      .map((item, index) => ({
        rank: index + 1,
        name: profile.name || 'Guest Student',
        branch: item.branch,
        sgpa: item.sgpa,
        semester: item.semester,
        batch_year: profile.batchYear,
      }))
  }, [branch, history, officialOnly, profile.batchYear, profile.isPublic, profile.name, semester])

  const rows = (supabase ? remoteRows : localRows).filter((row) => (batchYear === 'all' ? true : String(row.batch_year ?? '') === batchYear))
  const batchYears = Array.from(new Set((supabase ? remoteRows : localRows).map((row) => String(row.batch_year ?? '')).filter(Boolean))).sort()
  const averageSgpa = rows.length ? rows.reduce((sum, row) => sum + Number(row.sgpa), 0) / rows.length : null
  const highestSgpa = rows.length ? Math.max(...rows.map((row) => Number(row.sgpa))) : null

  return (
    <div className="space-y-5">
      <div className="page-heading">
        <div>
          <p className="section-kicker">Opt-in only</p>
          <h1>Leaderboard</h1>
          <p>This is not an official TCET ranking. It only includes users who opted in.</p>
        </div>
        <Trophy className="size-8 text-amber-300" />
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
            <select className="select-input" value={semester} onChange={(event) => setSemester(Number(event.target.value))}>
              <option value={1}>Sem I</option>
              <option value={2}>Sem II</option>
            </select>
          </label>
          <label>
            <span className="input-label">Batch year</span>
            <select className="select-input" value={batchYear} onChange={(event) => setBatchYear(event.target.value)}>
              <option value="all">All batches</option>
              {batchYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <span>
              <span className="block text-sm font-semibold text-white">Official only</span>
              <span className="block text-xs text-slate-400">Locked, confirmed results only.</span>
            </span>
            <input
              checked={officialOnly}
              className="size-5 accent-amber-400"
              type="checkbox"
              onChange={(event) => setOfficialOnly(event.target.checked)}
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Average SGPA" value={averageSgpa === null ? '--' : averageSgpa.toFixed(2)} />
        <StatCard label="Highest SGPA" value={highestSgpa === null ? '--' : highestSgpa.toFixed(2)} />
        <StatCard label="Public entries" value={String(rows.length)} />
      </section>

      <section className="surface-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[640px]">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>Branch</th>
                <th>Semester</th>
                <th>Batch Year</th>
                <th>SGPA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.rank}-${row.masked_name ?? row.name}-${row.sgpa}`}>
                  <td className="font-mono text-white">#{row.rank}</td>
                  <td>{row.masked_name ?? maskName(row.name)}</td>
                  <td>{row.branch}</td>
                  <td>Sem {row.semester}</td>
                  <td>{row.batch_year ?? '--'}</td>
                  <td className="font-mono text-white">{Number(row.sgpa).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="border-t border-white/10 p-6 text-sm text-slate-400">
            No public verified results for this filter yet.
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="surface-panel p-4">
      <p className="text-xs uppercase tracking-normal text-slate-400">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold text-white">{value}</p>
    </div>
  )
}
