export const TCET_ALLOWED_EMAIL_DOMAINS = (import.meta.env.VITE_TCET_ALLOWED_EMAIL_DOMAINS || 'tcetmumbai.in')
  .split(',')
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean)

export function getEmailDomain(email) {
  if (!email || !String(email).includes('@')) return null
  return String(email).split('@').at(-1)?.trim().toLowerCase() || null
}

export function isTcetEmailDomain(domain) {
  if (!domain) return false
  return TCET_ALLOWED_EMAIL_DOMAINS.includes(String(domain).trim().toLowerCase())
}

export function getAuthProvider(user) {
  return (
    user?.app_metadata?.provider ||
    user?.identities?.[0]?.provider ||
    user?.user_metadata?.provider ||
    null
  )
}

export function getAuthProfileFields(user) {
  const emailDomain = getEmailDomain(user?.email)
  return {
    authProvider: getAuthProvider(user),
    emailDomain,
    tcetVerified: isTcetEmailDomain(emailDomain),
  }
}
