# Launch Checklist

## Local verification

- Run `npm run lint`
- Run `npm test`
- Run `npm run build`
- Open `http://127.0.0.1:5173/`
- Test guest calculator save/refresh restore
- Test PDF parser with an anonymized text-based office-register PDF
- Test `/debug/subjects` for the selected branch/semester template

## Supabase

- Run `supabase/migrations/20260607_parser_and_official_results.sql` in the live project.
- Confirm tables include `profiles`, `semester_results`, and `subject_marks`.
- Confirm `leaderboard` and `public_leaderboard` views expose only safe fields.
- Confirm RLS is enabled on all three tables.
- Confirm Google auth is enabled.
- Keep Email auth enabled only as a fallback.
- If using email in production, configure custom SMTP.
- Add redirect URLs:
  - `http://127.0.0.1:5173/`
  - `http://localhost:5173/`
  - production deployed URL

## Vercel

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_AUTH_REDIRECT_URL`
  - `VITE_TCET_ALLOWED_EMAIL_DOMAINS`

## Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- `public/_redirects` already contains `/* /index.html 200`
- Environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_AUTH_REDIRECT_URL`
  - `VITE_TCET_ALLOWED_EMAIL_DOMAINS`

## GitHub Pages

- Existing workflow builds from `main`.
- `vite.config.js` supports `VITE_BASE_PATH`.
- Add the GitHub Pages URL to Supabase Auth redirect URLs.

## Post-deploy QA

- Open production URL.
- Test Google login from a fresh browser.
- Test email magic-link fallback if enabled.
- Save a manual result.
- Upload a text-based PDF and apply parsed marks.
- Save an official locked PDF result.
- Toggle public profile and confirm leaderboard shows masked name only.
