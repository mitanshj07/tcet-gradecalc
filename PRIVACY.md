# Privacy

TCET GradeCalc is designed to keep sensitive student data local unless the user explicitly saves structured data.

## PDF import

- Your PDF is parsed locally in your browser.
- The PDF file is not uploaded.
- Full raw extracted text is not saved by default.
- Only confirmed structured marks/results are saved when the user chooses to save.

## Guest mode

- Guest marks and history stay in localStorage.
- Guest users can calculate SGPA, use planning tools, and parse PDFs locally.

## Logged-in mode

- Supabase stores profile, semester result summaries, and confirmed subject marks.
- Roll number is private and never shown on the leaderboard.
- Email is handled by Supabase Auth and is not exposed publicly.

## Leaderboard

- Leaderboard is opt-in.
- Names are masked.
- Raw subject marks, roll numbers, full names, and emails are not exposed.

## Deletion/export

Users can export local history as CSV from Profile. Account/data deletion should be handled through the Supabase project admin flow until a self-service deletion screen is added.
