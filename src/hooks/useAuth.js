import { useEffect, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../utils/supabase'
import { getAuthProfileFields } from '../utils/authDomains'
import { getRedirectUrl, parseAuthCallbackUrl } from '../utils/authRedirect'

// Auth flow is handled natively by @supabase/supabase-js v2

function resolveRedirectUrl() {
  return getRedirectUrl({
    configuredRedirectUrl: import.meta.env.VITE_AUTH_REDIRECT_URL ?? '',
    origin: window.location.origin,
    baseUrl: import.meta.env.BASE_URL,
  })
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(hasSupabaseConfig)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    let mounted = true

    supabase.auth.getSession()
      .then(({ data, error: authError }) => {
        if (!mounted) return
        if (authError && authError.message !== 'Auth session missing!') {
          setError(authError.message)
        } else {
          setError(null)
        }
        setUser(data.session?.user ?? null)
      })
      .finally(() => mounted && setLoading(false))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setError(null)
      setUser(session?.user ?? null)
      
      // Clean up URL parameters after successful sign in
      if (event === 'SIGNED_IN' && typeof window !== 'undefined') {
        const parsed = parseAuthCallbackUrl(window.location.href)
        if (parsed.hasCallbackParams) {
          window.history.replaceState({}, document.title, resolveRedirectUrl())
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signInWithGoogle() {
    setError(null)

    if (!supabase) {
      setError('Supabase is not configured yet. Guest mode is available.')
      return { error: new Error('Supabase is not configured') }
    }

    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: resolveRedirectUrl(),
        queryParams: {
          prompt: 'select_account',
          hd: 'tcetmumbai.in',
        },
      },
    })
  }

  async function signInWithEmail(email) {
    setError(null)

    if (!supabase) {
      setError('Supabase is not configured yet. Guest mode is available.')
      return { error: new Error('Supabase is not configured') }
    }

    return supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: resolveRedirectUrl(),
      },
    })
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return {
    user,
    authProfile: getAuthProfileFields(user),
    loading,
    error,
    hasSupabaseConfig,
    signInWithEmail,
    signInWithGoogle,
    signOut,
  }
}
