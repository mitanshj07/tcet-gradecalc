import { useEffect } from 'react'
import { ensureRemoteProfileAuthFields, fetchRemoteHistory, fetchRemoteProfile } from '../utils/supabaseData'
import { supabase } from '../utils/supabase'
import { useStore } from '../store/useStore'

export function useSupabaseSync() {
  const branch = useStore((state) => state.branch)
  const hydrateRemoteData = useStore((state) => state.hydrateRemoteData)
  const setRemoteSession = useStore((state) => state.setRemoteSession)

  useEffect(() => {
    if (!supabase) return undefined

    let cancelled = false

    async function syncUser(user) {
      if (!user) {
        if (!cancelled) setRemoteSession({ userId: null, status: 'idle' })
        return
      }

      if (!cancelled) setRemoteSession({ userId: user.id, status: 'loading' })

      try {
        await ensureRemoteProfileAuthFields(user.id, user, branch)
        const remoteProfile = await fetchRemoteProfile(user.id, branch)
        const resolvedProfile = remoteProfile ?? useStore.getState().profile
        const remoteHistory = await fetchRemoteHistory(user.id, resolvedProfile.branch)

        if (!cancelled) {
          hydrateRemoteData({
            profile: resolvedProfile,
            history: remoteHistory,
            userId: user.id,
          })
        }
      } catch (error) {
        if (!cancelled) {
          setRemoteSession({
            userId: user.id,
            status: 'error',
            error: error.message ?? 'Failed to load Supabase data.',
          })
        }
      }
    }

    supabase.auth.getUser().then(({ data }) => syncUser(data.user ?? null))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session?.user ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [branch, hydrateRemoteData, setRemoteSession])
}
