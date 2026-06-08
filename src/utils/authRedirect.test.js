import { describe, expect, it } from 'vitest'
import { getRedirectUrl, parseAuthCallbackUrl } from './authRedirect'

describe('authRedirect', () => {
  it('builds a public redirect URL from configured env', () => {
    expect(
      getRedirectUrl({
        configuredRedirectUrl: 'https://tcet-gradecalc.vercel.app',
        origin: 'http://localhost:5173',
        baseUrl: '/',
      }),
    ).toBe('https://tcet-gradecalc.vercel.app')
  })

  it('falls back to the current origin when no env redirect is set', () => {
    expect(
      getRedirectUrl({
        configuredRedirectUrl: '',
        origin: 'https://tcet-gradecalc.vercel.app',
        baseUrl: '/',
      }),
    ).toBe('https://tcet-gradecalc.vercel.app')
  })

  it('parses query-code auth callbacks', () => {
    expect(parseAuthCallbackUrl('https://tcet-gradecalc.vercel.app/?code=abc123')).toMatchObject({
      code: 'abc123',
      hasCallbackParams: true,
    })
  })

  it('parses token-hash email callbacks', () => {
    expect(parseAuthCallbackUrl('https://tcet-gradecalc.vercel.app/?token_hash=hash123&type=email')).toMatchObject({
      tokenHash: 'hash123',
      type: 'email',
      hasCallbackParams: true,
    })
  })

  it('parses implicit hash-token callbacks without confusing hash routes', () => {
    expect(
      parseAuthCallbackUrl('https://tcet-gradecalc.vercel.app/#access_token=aaa&refresh_token=bbb'),
    ).toMatchObject({
      accessToken: 'aaa',
      refreshToken: 'bbb',
      hasCallbackParams: true,
    })

    expect(parseAuthCallbackUrl('https://tcet-gradecalc.vercel.app/#/calculator')).toMatchObject({
      hasCallbackParams: false,
    })
  })
})
