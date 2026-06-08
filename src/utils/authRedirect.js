export function getRedirectUrl({
  configuredRedirectUrl = '',
  origin = typeof window !== 'undefined' ? window.location.origin : '',
  baseUrl = '/',
} = {}) {
  const trimmedConfigured = configuredRedirectUrl.trim()
  const base = trimmedConfigured || origin
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const normalizedBaseUrl = baseUrl === '/' ? '' : baseUrl.replace(/\/?$/, '/')
  return `${normalizedBase}${normalizedBaseUrl}`
}

export function parseAuthCallbackUrl(urlString) {
  const url = new URL(urlString, 'https://example.com')
  const hashSource = url.hash.startsWith('#/') ? '' : url.hash.replace(/^#/, '')
  const hash = new URLSearchParams(hashSource)

  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const accessToken = hash.get('access_token')
  const refreshToken = hash.get('refresh_token')
  const expiresAt = hash.get('expires_at')

  return {
    code,
    tokenHash,
    type,
    accessToken,
    refreshToken,
    expiresAt,
    hasCallbackParams: Boolean(code || (tokenHash && type) || (accessToken && refreshToken)),
  }
}
