import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { useSupabaseSync } from './hooks/useSupabaseSync'
import { useStore } from './store/useStore'

const Analysis = lazy(() => import('./pages/Analysis'))
const Calculator = lazy(() => import('./pages/Calculator'))
const DebugSubjects = lazy(() => import('./pages/DebugSubjects'))
const Disclaimer = lazy(() => import('./pages/Disclaimer'))
const Landing = lazy(() => import('./pages/Landing'))
const Leaderboard = lazy(() => import('./pages/Leaderboard'))
const NotFound = lazy(() => import('./pages/NotFound'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const Profile = lazy(() => import('./pages/Profile'))

export default function App() {
  const theme = useStore((state) => state.theme)
  useSupabaseSync()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<AppShell />}>
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/history" element={<Profile />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/debug/subjects" element={<DebugSubjects />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/not-found" element={<NotFound />} />
          </Route>
          <Route path="*" element={<Navigate replace to="/not-found" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0f1a] text-white">
      <div className="rounded-xl border border-white/10 bg-slate-900/80 px-5 py-4 font-mono text-sm text-amber-200">
        Loading TCET GradeCalc
      </div>
    </div>
  )
}
