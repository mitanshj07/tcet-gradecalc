import { describe, expect, it } from 'vitest'
import { maskName } from './privacy'
import { mapProfileRow } from './supabaseData'

describe('privacy utilities', () => {
  it('masks leaderboard names', () => {
    expect(maskName('Sample Student')).toBe('S***** S******')
  })

  it('falls back to Anonymous for blank public names', () => {
    expect(maskName('')).toBe('Anonymous')
  })

  it('maps display_name without exposing email or roll number publicly', () => {
    expect(mapProfileRow({ display_name: 'Test User', branch: 'AIDS', batch_year: 2025, is_public: true })).toMatchObject({
      name: '',
      leaderboardName: 'Test User',
      branch: 'AIDS',
      batchYear: '2025',
      isPublic: true,
    })
  })
})
