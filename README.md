# TCET GradeCalc

Unofficial TCET Mumbai SGPA/CGPA calculator for CBCGS-HME 2023 students.

- **Production URL:** [https://tcet-gradecalc.vercel.app/](https://tcet-gradecalc.vercel.app/)
- **Calculator route:** [https://tcet-gradecalc.vercel.app/#/calculator](https://tcet-gradecalc.vercel.app/#/calculator)

## What it does

- Branch-aware FE subject catalog with verification metadata.
- IA/ESE/TW/PR grading engine with ATKT detection.
- Guest-mode persistence in localStorage.
- Supabase-backed profile/history/leaderboard flow.
- Privacy-safe client-side PDF gazette/result parser using `pdfjs-dist`.
- Branch/semester/cycle-aware Office Register parser with manual template override.
- Manual vs official result handling with parser confidence metadata.
- What-if simulator, impact ranking, target calculator, CGPA planner, PNG/PDF share card.
- PWA shell with offline fallback and Netlify SPA redirect file.

Important wording: the grading system is common across supported TCET CBCGS-HME 2023-style templates. The branch/semester/cycle differences are subject templates: course order, credits, TW/PR/OR components, and max marks.

## Local development

```bash
npm install
npm run dev -- --host 127.0.0.1
```

App URL:

`http://127.0.0.1:5173/`

## Validation

```bash
npm run lint
npm run build
npm test
```

## Environment variables

Set these in local `.env.local` and any hosting platform:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_AUTH_REDIRECT_URL=...
VITE_TCET_ALLOWED_EMAIL_DOMAINS=tcetmumbai.in
```

## Supabase setup

1. Run `supabase/schema.sql` for a fresh project, or `supabase/migrations/20260607_parser_and_official_results.sql` on the current live project.
2. Enable Google auth for production and keep Email auth as fallback.
3. Add redirect URLs:
   - `http://127.0.0.1:5173/`
   - `http://localhost:5173/`
   - your LAN URL if you test on a phone, for example `http://192.168.1.25:5173/`
   - your production URL

Production auth strategy:

- Google OAuth is the primary sign-in path.
- Email magic link stays available as a secondary fallback.
- Guest mode always stays available.
- If you keep email login in production, use custom SMTP rather than the default Supabase email quota.

If you open the app on your phone during local testing, set `VITE_AUTH_REDIRECT_URL` to a reachable address instead of `localhost`. The easiest options are:

- your computer's LAN IP, like `http://192.168.1.25:5173`
- a deployed preview URL

Do not disable email confirmation for production by default. That is only acceptable for local testing if you explicitly choose it.

## Hosting

### Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirects file is already included at `public/_redirects`

### Vercel

- Build command: `npm run build`
- Output directory: `dist`

### GitHub Pages

- Existing workflow builds with `VITE_BASE_PATH=/<repo-name>/`
- Keep HashRouter and add the Pages URL to Supabase redirect URLs

## Privacy notes

- Raw PDFs are parsed locally in the browser.
- Raw PDFs are not uploaded by default.
- Full raw extracted text is not saved by default.
- Only confirmed structured marks/profile data are saved to Supabase.
- Leaderboard is opt-in and masks names by default.

## More docs

- `LAUNCH_CHECKLIST.md`
- `PARSER_NOTES.md`
- `SUPABASE_SETUP.md`
- `PRIVACY.md`
- `DISCLAIMER.md`
