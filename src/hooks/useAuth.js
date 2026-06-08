import { useEffect, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../utils/supabase'
import { TCET_ALLOWED_EMAIL_DOMAINS, getAuthProfileFields } from '../utils/authDomains'
import { getRedirectUrl, parseAuthCallbackUrl } from '../utils/authRedirect'

let authRedirectBootstrap = null
let authRedirectHandled = false

function resolveRedirectUrl() {
  return getRedirectUrl({
    configuredRedirectUrl: import.meta.env.VITE_AUTH_REDIRECT_URL ?? '',
    origin: window.location.origin,
    baseUrl: import.meta.env.BASE_URL,
  })
}

async function finishAuthRedirect() {
  if (!supabase || typeof window === 'undefined' || authRedirectHandled) {
    return null
  }

  if (authRedirectBootstrap) {
    return authRedirectBootstrap
  }

  authRedirectBootstrap = (async () => {
    const parsed = parseAuthCallbackUrl(window.location.href)

    try {
      if (!parsed.hasCallbackParams) {
        authRedirectHandled = true
        return null
      }

      if (parsed.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(parsed.code)
        if (error) throw error
      } else if (parsed.tokenHash && parsed.type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: parsed.tokenHash,
          type: parsed.type,
        })
        if (error) throw error
      } else if (parsed.accessToken && parsed.refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        })
        if (error) throw error
      }

      window.history.replaceState({}, document.title, resolveRedirectUrl())
      authRedirectHandled = true
      return null
    } finally {
      authRedirectBootstrap = null
    }
  })()

  return authRedirectBootstrap
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

    finishAuthRedirect()
      .catch((authError) => {
        if (!mounted) return
        setError(authError.message ?? 'Could not complete sign-in from the email link.')
      })
      .then(() => supabase.auth.getSession())
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setError(null)
      setUser(session?.user ?? null)
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
