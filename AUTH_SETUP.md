# Auth Setup

## Production Authentication Strategy

- **Google OAuth** is the primary sign-in path.
- **Email Magic Link** stays available as a secondary fallback.
- **Guest mode** always stays available.

## Google OAuth Configuration

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Set up the OAuth consent screen.
4. Create OAuth client ID credentials for a Web application.
5. Add your Supabase project's callback URL to the "Authorized redirect URIs" in Google Cloud.
   - Example: `https://<project-ref>.supabase.co/auth/v1/callback`
6. Copy the Client ID and Client Secret.
7. Go to your Supabase Dashboard -> Authentication -> Providers -> Google.
8. Enable it and paste the Client ID and Client Secret.

Note: The app passes `hd: "tcetmumbai.in"` to Google OAuth as a hint. Actual TCET domain verification is done securely based on `session.user.email` domain in the application logic.

## Supabase Redirect URLs

Because the app uses a HashRouter (`react-router-dom`), the root URL is the safest callback target for OAuth and magic links.

Ensure the following URLs are added to the Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs:

- `https://tcet-gradecalc.vercel.app/`
- `http://127.0.0.1:5173/`
- `http://localhost:5173/`

**Do not require the hash URL (`/#/calculator`) as the main callback. The root production URL is safest.**

## Email Fallback and Custom SMTP

If you keep email login in production, use custom SMTP rather than the default Supabase email quota.
Configure SMTP in the Supabase dashboard:

- Project Settings -> Auth -> SMTP Settings

Brevo, Resend SMTP, and similar providers work well. Do not store SMTP credentials in this repo.
Do not disable email confirmation for production by default.
