import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Download, Edit3, ShieldCheck, Trash2 } from 'lucide-react'
import CGPATracker from '../components/Charts/CGPATracker'
import { useAuth } from '../hooks/useAuth'
import { useStore } from '../store/useStore'
import { BRANCHES } from '../utils/semesterData'
import { maskName } from '../utils/privacy'
import { upsertRemoteProfile } from '../utils/supabaseData'

export default function Profile() {
  const navigate = useNavigate()
  const profile = useStore((state) => state.profile)
  const history = useStore((state) => state.history)
  const updateProfile = useStore((state) => state.updateProfile)
  const deleteHistoryItem = useStore((state) => state.deleteHistoryItem)
  const restoreSnapshot = useStore((state) => state.restoreSnapshot)
  const remoteStatus = useStore((state) => state.remoteStatus)
  const remoteError = useStore((state) => state.remoteError)
  const { user, authProfile, hasSupabaseConfig, signOut } = useAuth()
  const [profileNotice, setProfileNotice] = useState('')
  const [historyError, setHistoryError] = useState('')
  const lastSavedProfile = useRef('')
  const seededRemoteProfile = useRef('')

  useEffect(() => {
    const seedKey = user && remoteStatus === 'ready' ? `${user.id}:ready` : ''

    if (seedKey && seededRemoteProfile.current !== seedKey) {
      lastSavedProfile.current = JSON.stringify(profile)
      seededRemoteProfile.current = seedKey
    }

    if (!seedKey) {
      seededRemoteProfile.current = ''
    }
  }, [profile, remoteStatus, user])

  useEffect(() => {
    if (!user || remoteStatus !== 'ready') return undefined

    const serializedProfile = JSON.stringify(profile)
    if (serializedProfile === lastSavedProfile.current) return undefined

    const timer = window.setTimeout(async () => {
      try {
        await upsertRemoteProfile(user.id, profile, user)
        lastSavedProfile.current = serializedProfile
        setProfileNotice('Profile synced to Supabase.')
      } catch (error) {
        setProfileNotice(error.message ?? 'Could not sync profile right now.')
      }
    }, 500)

    return () => window.clearTimeout(timer)
  }, [profile, remoteStatus, user])

  function exportCSV() {
    const header = ['semester', 'branch', 'academic_year', 'sgpa', 'earned_credits', 'total_credits', 'credit_points', 'created_at']
    const rows = history.map((item) => [
      item.semester,
      item.branchLabel,
      item.academicYear,
      item.sgpa,
      item.earnedCredits,
      item.totalCredits,
      item.creditPoints,
      item.createdAt,
    ])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.download = 'tcet-gradecalc-history.csv'
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  }

  async function handleDeleteHistoryItem(id) {
    setHistoryError('')

    try {
      await deleteHistoryItem(id)
    } catch (error) {
      setHistoryError(error.message ?? 'Could not delete this snapshot right now.')
    }
  }

  function handleRestoreSnapshot(item, unlock = false) {
    restoreSnapshot(item)
    setProfileNotice(
      unlock
        ? 'Official result loaded back into the calculator. Saving again will overwrite this semester as an unlocked manual estimate.'
        : 'Saved result loaded back into the calculator.',
    )
    navigate('/calculator')
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
      <section className="surface-panel p-4">
        <div>
          <p className="section-kicker">Profile</p>
          <h1 className="text-2xl font-semibold text-white">Student details</h1>
          <p className="mt-2 text-sm text-slate-300">
            {user ? user.email : hasSupabaseConfig ? 'Guest mode active.' : 'Guest mode active until Supabase credentials are added.'}
          </p>
          {user && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {(profile.tcetVerified || authProfile.tcetVerified) && (
                <span className="status-pill status-success">
                  <BadgeCheck className="size-3.5" />
                  TCET verified
                </span>
              )}
              {!!(profile.authProvider || authProfile.authProvider) && (
                <span className="status-pill status-info">
                  <ShieldCheck className="size-3.5" />
                  {profile.authProvider || authProfile.authProvider}
                </span>
              )}
            </div>
          )}
          {remoteStatus === 'loading' && <p className="mt-2 text-sm text-amber-200">Loading saved Supabase data...</p>}
          {remoteError && <p className="mt-2 text-sm text-red-200">{remoteError}</p>}
          {profileNotice && <p className="mt-2 text-sm text-emerald-200">{profileNotice}</p>}
        </div>

        <div className="mt-5 space-y-3">
          <label>
            <span className="input-label">Name</span>
            <input className="mark-input" value={profile.name} onChange={(event) => updateProfile({ name: event.target.value })} />
          </label>
          <label>
            <span className="input-label">Branch</span>
            <select className="select-input" value={profile.branch} onChange={(event) => updateProfile({ branch: event.target.value })}>
              {BRANCHES.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="input-label">Batch year</span>
              <input className="mark-input" value={profile.batchYear} onChange={(event) => updateProfile({ batchYear: event.target.value })} />
            </label>
            <label>
              <span className="input-label">Roll no</span>
              <input className="mark-input" value={profile.rollNo} onChange={(event) => updateProfile({ rollNo: event.target.value })} />
            </label>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <span>
              <span className="block text-sm font-semibold text-white">Public leaderboard</span>
              <span className="block text-xs text-slate-400">Manual estimates and official results can appear. Marks are never shown publicly.</span>
            </span>
            <input
              checked={profile.isPublic}
              className="size-5 accent-amber-400"
              type="checkbox"
              onChange={(event) => updateProfile({ isPublic: event.target.checked })}
            />
          </label>
          {profile.isPublic && (
            <label>
              <span className="input-label">Leaderboard display name</span>
              <input
                className="mark-input"
                maxLength={30}
                placeholder="Leave blank to auto-mask your name"
                value={profile.leaderboardName ?? ''}
                onChange={(event) => updateProfile({ leaderboardName: event.target.value })}
              />
              <p className="mt-2 text-xs text-slate-400">
                Public preview: {profile.leaderboardName?.trim() || maskName(profile.name || 'Your Name')}
              </p>
            </label>
          )}
          <p className="text-xs text-slate-400">
            {user ? 'Profile changes sync automatically.' : 'Sign in to publish results to the shared leaderboard.'}
          </p>
          {user && (
            <button type="button" className="secondary-button w-full" onClick={signOut}>
              Sign out
            </button>
          )}
        </div>
      </section>

      <section className="space-y-5">
        <CGPATracker history={history} />
        {historyError && <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{historyError}</div>}

        <div className="surface-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
            <div>
              <p className="section-kicker">History</p>
              <h2 className="panel-title">Semester snapshots</h2>
            </div>
            <button type="button" className="secondary-button" disabled={!history.length} onClick={exportCSV}>
              <Download className="size-4" />
              CSV
            </button>
          </div>

          <div className="divide-y divide-white/10">
            {history.length ? (
              history.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold text-white">
                      {item.branchLabel} / Sem {item.semester}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                      <span className={`status-pill ${item.isOfficial ? 'status-success' : 'status-muted'}`}>
                      {item.isOfficial ? 'Official Result' : 'Manual Estimate'}
                      </span>
                      {(profile.tcetVerified || authProfile.tcetVerified) && <span className="status-pill status-success">TCET Verified</span>}
                      {item.isLocked && <span className="status-pill status-warning">Locked</span>}
                      {item.source === 'pdf' && item.parserConfidence !== null && (
                        <span className="status-pill status-info">Parser {Math.round(item.parserConfidence * 100)}%</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-2xl font-semibold text-white">{item.sgpa.toFixed(2)}</span>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleRestoreSnapshot(item)}
                    >
                      Use in Calculator
                    </button>
                    {item.isOfficial && (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleRestoreSnapshot(item, true)}
                      >
                        <Edit3 className="size-4" />
                        Unlock for correction
                      </button>
                    )}
                    <button type="button" className="icon-button" title="Delete snapshot" onClick={() => handleDeleteHistoryItem(item.id)}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-sm text-slate-400">No saved snapshots yet.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
