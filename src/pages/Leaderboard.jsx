import { useEffect, useMemo, useState } from 'react'
import { Trophy } from 'lucide-react'
import { supabase } from '../utils/supabase'
import { useStore } from '../store/useStore'
import { BRANCHES } from '../utils/semesterData'
import { maskName } from '../utils/privacy'

export default function Leaderboard() {
  const [branch, setBranch] = useState('all')
  const [semester, setSemester] = useState(1)
  const [batchYear, setBatchYear] = useState('all')
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')
  const [remoteRows, setRemoteRows] = useState([])
  const [remoteStats, setRemoteStats] = useState(null)
  const profile = useStore((state) => state.profile)
  const history = useStore((state) => state.history)
  const remoteUserId = useStore((state) => state.remoteUserId)

  function handleBranchChange(event) {
    setLoading(Boolean(supabase))
    setError('')
    setBranch(event.target.value)
  }

  function handleSemesterChange(event) {
    setLoading(Boolean(supabase))
    setError('')
    setSemester(Number(event.target.value))
  }

  useEffect(() => {
    if (!supabase) {
      return
    }

    let cancelled = false

    async function loadLeaderboard() {
      let leaderboardQuery = supabase
        .from('leaderboard_view')
        .select('user_id, display_name, branch, batch_year, semester, academic_year, sgpa, total_credits, updated_at, rank_in_branch, rank_overall, is_official, is_locked, source')
        .eq('semester', semester)
        .order('rank_overall', { ascending: true })
        .limit(100)

      if (branch !== 'all') {
        leaderboardQuery = leaderboardQuery.eq('branch', branch)
      }

      const [{ data, error: leaderboardError }, { data: statsData, error: statsError }] = await Promise.all([
        leaderboardQuery,
        (() => {
          let statsQuery = supabase
            .from('leaderboard_stats')
            .select('branch, semester, academic_year, total_students, avg_sgpa, max_sgpa, min_sgpa, distinction_count, first_class_count, official_count, manual_count')
            .eq('semester', semester)

          if (branch !== 'all') {
            statsQuery = statsQuery.eq('branch', branch)
          }

          return statsQuery
        })(),
      ])

      if (leaderboardError) throw leaderboardError
      if (statsError) throw statsError

      const aggregatedStats = (statsData ?? []).reduce(
        (acc, item) => {
          const totalStudents = acc.total_students + Number(item.total_students ?? 0)
          const itemStudents = Number(item.total_students ?? 0)
          const itemAvg = Number(item.avg_sgpa ?? 0)
          const weightedSum = acc._weightedSum + itemAvg * itemStudents

          return {
            total_students: totalStudents,
            avg_sgpa: totalStudents ? (weightedSum / totalStudents).toFixed(2) : null,
            max_sgpa: Math.max(acc.max_sgpa, Number(item.max_sgpa ?? 0)),
            distinction_count: acc.distinction_count + Number(item.distinction_count ?? 0),
            official_count: acc.official_count + Number(item.official_count ?? 0),
            manual_count: acc.manual_count + Number(item.manual_count ?? 0),
            _weightedSum: weightedSum,
          }
        },
        {
          total_students: 0,
          avg_sgpa: null,
          max_sgpa: 0,
          distinction_count: 0,
          official_count: 0,
          manual_count: 0,
          _weightedSum: 0,
        },
      )

      if (!cancelled) {
        setRemoteRows(data ?? [])
        setRemoteStats(aggregatedStats.total_students ? aggregatedStats : null)
        setLoading(false)
      }
    }

    loadLeaderboard().catch((nextError) => {
      if (cancelled) return
      setRemoteRows([])
      setRemoteStats(null)
      setError(nextError.message ?? 'Could not load the leaderboard right now.')
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [branch, semester])

  const localRows = useMemo(() => {
    if (supabase || !profile.isPublic) return []
    return history
      .filter((item) => (branch === 'all' ? true : item.branch === branch))
      .filter((item) => item.semester === semester)
      .sort((left, right) => right.sgpa - left.sgpa)
      .map((item, index) => ({
        user_id: `guest-${index}`,
        rank_overall: index + 1,
        display_name: profile.leaderboardName?.trim() || maskName(profile.name || 'Guest Student'),
        branch: item.branch,
        sgpa: item.sgpa,
        semester: item.semester,
        batch_year: profile.batchYear,
        is_official: Boolean(item.isOfficial),
        is_locked: Boolean(item.isLocked),
        source: item.source ?? 'manual',
      }))
  }, [branch, history, profile.batchYear, profile.isPublic, profile.leaderboardName, profile.name, semester])

  const sourceRows = supabase ? remoteRows : localRows
  const rows = sourceRows.filter((row) => (batchYear === 'all' ? true : String(row.batch_year ?? '') === batchYear))
  const batchYears = Array.from(new Set(sourceRows.map((row) => String(row.batch_year ?? '')).filter(Boolean))).sort()
  const averageSgpa = rows.length ? rows.reduce((sum, row) => sum + Number(row.sgpa), 0) / rows.length : null
  const highestSgpa = rows.length ? Math.max(...rows.map((row) => Number(row.sgpa))) : null
  const currentUserEntry = remoteUserId ? rows.find((row) => row.user_id === remoteUserId) : null
  const distinctionCount = rows.filter((row) => Number(row.sgpa) >= 7.84).length

  return (
    <div className="space-y-5">
      <div className="page-heading">
        <div>
          <p className="section-kicker">Opt-in only</p>
          <h1>Leaderboard</h1>
          <p>Public semester results appear here, including manual estimates. Individual marks are never shown.</p>
        </div>
        <Trophy className="size-8 text-amber-300" />
      </div>

      <section className="surface-panel p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label>
            <span className="input-label">Branch</span>
            <select className="select-input" value={branch} onChange={handleBranchChange}>
              <option value="all">All branches</option>
              {BRANCHES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="input-label">Semester</span>
            <select className="select-input" value={semester} onChange={handleSemesterChange}>
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
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
            <p className="font-semibold text-white">How to appear here</p>
            <p className="mt-1 text-xs text-slate-400">Save a semester result and enable leaderboard visibility in your profile. Official PDF imports are labeled separately.</p>
            {currentUserEntry && <p className="mt-3 text-xs text-amber-100">Your current rank: #{branch === 'all' ? currentUserEntry.rank_overall : currentUserEntry.rank_in_branch ?? currentUserEntry.rank_overall}</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Average SGPA" value={remoteStats?.avg_sgpa ?? (averageSgpa === null ? '--' : averageSgpa.toFixed(2))} />
        <StatCard label="Highest SGPA" value={remoteStats?.max_sgpa ?? (highestSgpa === null ? '--' : highestSgpa.toFixed(2))} />
        <StatCard label="Public entries" value={String(rows.length)} />
        <StatCard label="Distinctions" value={String(remoteStats?.distinction_count ?? distinctionCount)} />
        <StatCard label="Official results" value={String(remoteStats?.official_count ?? rows.filter((row) => row.is_official).length)} />
        <StatCard label="Manual estimates" value={String(remoteStats?.manual_count ?? rows.filter((row) => !row.is_official).length)} />
      </section>

      <section className="surface-panel overflow-hidden">
        {loading && <div className="border-b border-white/10 px-6 py-4 text-sm text-slate-400">Loading leaderboard...</div>}
        {error && !loading && <div className="border-b border-red-500/25 bg-red-500/10 px-6 py-4 text-sm text-red-100">{error}</div>}
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
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.user_id}-${row.semester}-${row.sgpa}`}>
                  <td className="font-mono text-white">#{branch === 'all' ? row.rank_overall : row.rank_in_branch ?? row.rank_overall}</td>
                  <td>{row.display_name ?? maskName(row.name)}</td>
                  <td>{row.branch}</td>
                  <td>Sem {row.semester}</td>
                  <td>{row.batch_year ?? '--'}</td>
                  <td className="font-mono text-white">{Number(row.sgpa).toFixed(2)}</td>
                  <td>{row.is_official ? 'Official' : 'Estimate'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !rows.length && (
          <div className="border-t border-white/10 p-6 text-sm text-slate-400">
            No public results for this filter yet. Save a semester result, then opt in from your profile.
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
