import { describe, expect, it } from 'vitest'
import { getAuthProfileFields, getEmailDomain, isTcetEmailDomain } from './authDomains'

describe('authDomains', () => {
  it('extracts lowercase email domains', () => {
    expect(getEmailDomain('Student@TCETMumbai.in')).toBe('tcetmumbai.in')
  })

  it('marks tcet domains as verified', () => {
    expect(isTcetEmailDomain('tcetmumbai.in')).toBe(true)
    expect(isTcetEmailDomain('gmail.com')).toBe(false)
  })

  it('derives auth profile fields from a Supabase user', () => {
    expect(
      getAuthProfileFields({
        email: 'student@tcetmumbai.in',
        app_metadata: { provider: 'google' },
      }),
    ).toMatchObject({
      authProvider: 'google',
      emailDomain: 'tcetmumbai.in',
      tcetVerified: true,
    })
  })
})
