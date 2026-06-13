# Supabase Setup

## Environment

Set these in `.env.local` and in your hosting platform:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_AUTH_REDIRECT_URL=...
VITE_TCET_ALLOWED_EMAIL_DOMAINS=tcetmumbai.in
```

## Fresh project

Run `supabase/schema.sql` in the SQL editor.

## Existing project

Run `supabase/migrations/20260607_parser_and_official_results.sql`, then `supabase/migrations/20260613_leaderboard_repair.sql`, then `supabase/migrations/20260613_leaderboard_include_manual_estimates.sql`.

The migration is additive:

- `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- `CREATE OR REPLACE VIEW`
- no `DROP TABLE`
- no `TRUNCATE`
- no deletion of user data

## Auth strategy

For production:

- Google OAuth should be the primary login.
- Email magic links should be fallback only.
- Guest mode should remain available.
- If you expect real traffic, configure custom SMTP in Supabase instead of depending on the default email quota.

Disabling email confirmation is acceptable only for local testing and should not be the default production path.

## Auth redirects

Add:

- `http://127.0.0.1:5173/`
- `http://localhost:5173/`
- your LAN URL if you test on a phone, for example `http://192.168.1.25:5173/`
- production deployed URL

If you want phone-based login during local development, set `VITE_AUTH_REDIRECT_URL` to a reachable address such as your computer's LAN IP or a preview deployment URL.

The app uses a hash router, so the root URL is the safest magic-link callback target.

## Custom SMTP fallback

If email sign-in is kept for production, configure SMTP in the Supabase dashboard:

- Project Settings
- Auth
- SMTP Settings

Brevo, Resend SMTP, and similar providers work well. Do not store SMTP credentials in this repo.

## RLS

The schema enables RLS for:

- `profiles`
- `semester_results`
- `subject_marks`

Users can manage their own rows. Public leaderboard views expose masked aggregate-safe fields only and never expose raw subject marks, roll number, or email.

## Troubleshooting

- If saves fail after deployment, confirm the migration ran and env vars are present.
- If magic link opens but no session appears, confirm the production URL is in Supabase redirect URLs.
- If leaderboard is empty, confirm the latest leaderboard migrations ran, the profile is public, and the result has an SGPA saved.
