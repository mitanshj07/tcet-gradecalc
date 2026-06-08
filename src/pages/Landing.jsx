import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, ShieldCheck, Mail, WifiOff } from 'lucide-react'
import heroImg from '../assets/hero.png'
import { useAuth } from '../hooks/useAuth'
import { useStore } from '../store/useStore'
import { BRANCHES } from '../utils/semesterData'

function formatAuthNotice(message) {
  if (!message) return ''

  const normalized = message.toLowerCase()

  if (normalized.includes('email rate limit exceeded')) {
    return 'Supabase auth email quota is exhausted right now. Wait a while and try again, or connect a custom SMTP provider for production use.'
  }

  return message
}

export default function Landing() {
  const navigate = useNavigate()
  const branch = useStore((state) => state.branch)
  const setBranch = useStore((state) => state.setBranch)
  const { error, hasSupabaseConfig, signInWithEmail, signInWithGoogle, user } = useAuth()
  const [email, setEmail] = useState('')
  const [localNotice, setLocalNotice] = useState('')

  useEffect(() => {
    if (user) {
      navigate('/calculator')
    }
  }, [navigate, user])

  async function handleEmailSignIn() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setLocalNotice('Enter your email first and we will send the sign-in link there.')
      return
    }

    const response = await signInWithEmail(trimmedEmail)
    if (response?.error) {
      setLocalNotice(formatAuthNotice(response.error.message) || 'Could not send the sign-in link right now.')
      return
    }

    setLocalNotice(`Magic link sent to ${trimmedEmail}. Open it on the phone or browser where you want to sign in.`)
  }

  function continueGuest() {
    navigate('/calculator')
  }

  async function handleGoogleSignIn() {
    const response = await signInWithGoogle()
    if (response?.error) {
      setLocalNotice(formatAuthNotice(response.error.message) || 'Could not start Google sign-in right now.')
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0f1a] text-white">
      <section className="mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            <Calculator className="size-4" />
            TCET Autonomous / CBCGS-HME 2023
          </div>

          <div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-tight text-white md:text-6xl">TCET GradeCalc</h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-300">
              Predict SGPA, catch ATKT heads, plan ESE targets, and keep semester snapshots in one place.
            </p>
          </div>

          {(localNotice || error || !hasSupabaseConfig) && (
            <div className="flex max-w-2xl items-start gap-3 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-100">
              <WifiOff className="mt-0.5 size-4 shrink-0" />
              <span>{formatAuthNotice(localNotice || error) || 'Supabase is optional until credentials are added. Guest data stays in this browser.'}</span>
            </div>
          )}

          <section className="space-y-3">
            <p className="section-kicker">Branch</p>
            <div className="grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {BRANCHES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`branch-card ${branch === item.id ? 'branch-card-active' : ''}`}
                  onClick={() => setBranch(item.id)}
                >
                  <span>{item.label}</span>
                  <small>{item.cycle === 'physics' ? 'Physics' : 'Chemistry'} cycle</small>
                </button>
              ))}
            </div>
          </section>

          <div className="max-w-xl space-y-3">
            <button type="button" className="primary-button w-full justify-center" onClick={handleGoogleSignIn}>
              <ShieldCheck className="size-4" />
              Continue with Google
            </button>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                className="mark-input"
                placeholder="your@email.com"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button type="button" className="primary-button" onClick={handleEmailSignIn}>
                <Mail className="size-4" />
                Continue with email
              </button>
            </div>
            <p className="text-sm text-slate-400">Email login may be rate-limited. Google login is recommended.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="secondary-button" onClick={continueGuest}>
              <Calculator className="size-4" />
              Continue as Guest
            </button>
          </div>
        </div>

        <div className="relative min-h-[420px]">
          <div className="absolute inset-0 rounded-[32px] border border-white/10 bg-slate-900/50 shadow-2xl shadow-black/40" />
          <div className="absolute left-6 right-6 top-6 rounded-2xl border border-white/10 bg-slate-950/85 p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm text-amber-300">LIVE SGPA</p>
              <span className="status-pill status-success">Ready</span>
            </div>
            <p className="mt-4 font-mono text-7xl font-semibold text-white">8.74</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <HeroMetric label="IA" value="34/40" />
              <HeroMetric label="ESE" value="48/60" />
              <HeroMetric label="Risk" value="0" />
            </div>
          </div>
          <img
            src={heroImg}
            alt=""
            className="absolute bottom-7 right-7 w-52 opacity-80 [filter:hue-rotate(140deg)_saturate(1.25)_brightness(1.2)]"
          />
          <div className="absolute bottom-8 left-6 right-32 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
            <p className="text-sm font-semibold text-amber-100">Head-wise pass check</p>
            <p className="mt-1 text-sm text-slate-300">IA and ESE are evaluated separately before SGPA credit points are counted.</p>
          </div>
        </div>
      </section>
    </main>
  )
}

function HeroMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-white">{value}</p>
    </div>
  )
}
