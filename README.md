<p align="center">
  <img src="assets/banner.png" alt="TCET GradeCalc Banner" width="100%" />
</p>

<h1 align="center">🎓 TCET GradeCalc</h1>

<p align="center">
  <strong>The most advanced unofficial SGPA/CGPA calculator ever built for TCET Mumbai.</strong><br/>
  <em>Upload your gazette PDF → Get instant, 100% accurate results → Track your academic journey.</em>
</p>

<p align="center">
  <a href="https://tcet-gradecalc.vercel.app/">
    <img src="https://img.shields.io/badge/🚀_LIVE_DEMO-Visit_App-0ea5e9?style=for-the-badge&labelColor=0f172a" alt="Live Demo" />
  </a>
  <a href="#-features">
    <img src="https://img.shields.io/badge/✨_Features-Explore-f59e0b?style=for-the-badge&labelColor=0f172a" alt="Features" />
  </a>
  <a href="#-quick-start">
    <img src="https://img.shields.io/badge/⚡_Quick_Start-Setup-10b981?style=for-the-badge&labelColor=0f172a" alt="Quick Start" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/mitanshj07/tcet-gradecalc?style=social" alt="GitHub Stars" />
  <img src="https://img.shields.io/github/forks/mitanshj07/tcet-gradecalc?style=social" alt="GitHub Forks" />
  <img src="https://img.shields.io/github/issues/mitanshj07/tcet-gradecalc?color=f59e0b" alt="Issues" />
  <img src="https://img.shields.io/github/license/mitanshj07/tcet-gradecalc?color=10b981" alt="License" />
  <img src="https://img.shields.io/badge/tests-68%2F68_passing-10b981" alt="Tests" />
  <img src="https://img.shields.io/badge/parser_accuracy-100%25-f59e0b" alt="Parser Accuracy" />
</p>

---

## 🤔 Why Does This Exist?

> **Every TCET student knows the pain:** Manually calculating your SGPA from a 50-column gazette PDF, praying you didn't misread a grade point, and then doing it all over again for CGPA across 8 semesters.

**TCET GradeCalc nukes that entire process.**

Upload your official gazette PDF. The AI-powered parser reads every single mark, validates it mathematically, and gives you your SGPA in under 2 seconds. No manual entry. No mistakes. No stress.

---

## ✨ Features

### 🧠 The Smart PDF Parser (The Crown Jewel)

This isn't your average text extractor. This is a **military-grade gazette parser** built specifically for TCET's Office Register format.

| Capability | Description |
|:--|:--|
| 🎯 **100% Parsing Accuracy** | Every ESE, IA, TW, PR, Grade, GP, and CP is extracted and cross-validated |
| 🔬 **Mathematical Verification** | `ESE + IA = Total`, `Grade ↔ GP`, `GP × Credits = CP` — every cell is verified |
| 🧩 **Template Matching** | Auto-detects branch, semester, cycle (Physics/Chemistry), and maps to the correct subject template |
| 📊 **Confidence Scoring** | Each parsed field gets a confidence score — low-confidence fields stay editable |
| 🔒 **Privacy-First** | PDF is parsed **100% locally in your browser**. Your file is never uploaded anywhere. |

### 📱 Full Feature Set

<table>
<tr>
<td width="50%">

#### 🧮 Core Calculator
- ISE1 / ISE2 / ISE3 → Auto IA calculation
- ESE, TW, PR, Oral — all component types
- Real-time SGPA computation
- ATKT detection with per-head failure tracking
- Branch-aware subject catalogs for all 11 TCET branches

</td>
<td width="50%">

#### 📈 Analytics & Planning
- What-If Simulator — *"What if I scored 5 more in ESE?"*
- Impact Ranking — *"Which subject affects my SGPA the most?"*
- Target Calculator — *"What marks do I need for 9.0 SGPA?"*
- CGPA Planner across all 8 semesters
- Beautiful interactive charts (Recharts)

</td>
</tr>
<tr>
<td width="50%">

#### 🏆 Social & Leaderboard
- Opt-in public leaderboard
- Privacy-masked names by default
- Filter by branch, semester, batch year
- Average & highest SGPA stats
- TCET email verification badge

</td>
<td width="50%">

#### 🔐 Auth & Data
- Google OAuth (primary)
- Email magic link (fallback)
- Guest mode (no login required!)
- Supabase-backed cloud sync
- LocalStorage persistence for guests
- Row-Level Security on all tables

</td>
</tr>
<tr>
<td width="50%">

#### 🎨 Share & Export
- PNG result card (screenshot-ready)
- PDF report generation
- One-tap share to WhatsApp/Instagram
- Beautiful dark-mode glassmorphism UI

</td>
<td width="50%">

#### 📱 Cross-Platform
- Works on **every** Android & iOS browser
- ES2015 build target for legacy Safari
- CDN-loaded PDF.js (no bundler issues)
- PWA installable with offline fallback
- Responsive from 320px to ultrawide

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     TCET GradeCalc                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Landing    │  │  Calculator  │  │     Analysis      │  │
│  │   (Hero)     │  │  (Marks UI)  │  │  (Charts/Sim)     │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                │                    │             │
│  ┌──────┴────────────────┴────────────────────┴──────────┐  │
│  │              Zustand Store (useStore)                  │  │
│  │  profile │ history │ marks │ subjects │ preferences    │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────┴────────────────────────────────┐  │
│  │                   Utils Layer                          │  │
│  │                                                       │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │  pdfExtract  │  │ officeRegist │  │   grading   │  │  │
│  │  │  (PDF.js CDN)│  │  erParser    │  │   engine    │  │  │
│  │  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  │  │
│  │         │                │                  │         │  │
│  │  ┌──────┴──────┐  ┌──────┴───────┐  ┌──────┴──────┐  │  │
│  │  │  branchCycle │  │  templates   │  │  confidence │  │  │
│  │  │  Resolver    │  │  (11 branch) │  │  scoring    │  │  │
│  │  └─────────────┘  └──────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────┴────────────────────────────────┐  │
│  │               Supabase Backend                         │  │
│  │  profiles │ semester_results │ subject_marks │ auth    │  │
│  │  leaderboard (view) │ RLS policies │ Google OAuth      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|:--|:--|
| **Frontend** | React 19 + Vite 8 |
| **State** | Zustand |
| **Styling** | Vanilla CSS (Glassmorphism dark theme) |
| **Charts** | Recharts |
| **PDF Parsing** | PDF.js v3.11.174 (CDN-loaded) |
| **Auth** | Supabase Auth (Google OAuth + Email) |
| **Database** | Supabase (PostgreSQL) |
| **Hosting** | Vercel / Netlify / GitHub Pages |
| **Testing** | Vitest (68/68 tests passing) |
| **Export** | html2canvas + jsPDF |

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+ 
- A [Supabase](https://supabase.com) project (free tier works perfectly)

### 1. Clone & Install

```bash
git clone https://github.com/mitanshj07/tcet-gradecalc.git
cd tcet-gradecalc
npm install
```

### 2. Configure Environment

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_AUTH_REDIRECT_URL=http://127.0.0.1:5173/
VITE_TCET_ALLOWED_EMAIL_DOMAINS=tcetmumbai.in
```

### 3. Setup Database

Run the schema in your Supabase SQL Editor:

```bash
# For a fresh project:
supabase/schema.sql

# For an existing project:
supabase/migrations/20260607_parser_and_official_results.sql
```

### 4. Launch

```bash
npm run dev
```

Open `http://127.0.0.1:5173/` and you're live! 🎉

---

## 🧪 Testing

```bash
# Run all 68 tests
npm test

# Lint check
npm run lint

# Production build
npm run build
```

All tests cover:
- ✅ Grading engine (35 test cases)
- ✅ Office Register parser (20 test cases)
- ✅ Auth redirect logic (5 test cases)
- ✅ Auth domain validation (3 test cases)
- ✅ Privacy masking (3 test cases)
- ✅ Full gazette integration (2 real PDF fixtures)

---

## 📋 Supported Branches

| Branch | Code | Sem 1 | Sem 2 |
|:--|:--|:--:|:--:|
| AI & Data Science | `AIDS` | ✅ | ✅ |
| AI & Machine Learning | `AIML` | ✅ | ✅ |
| Computer Engineering | `COMP` | ✅ | ✅ |
| Information Technology | `IT` | ✅ | ✅ |
| Computer Science & Engineering | `CSE` | ✅ | ✅ |
| Electronics & Computer Science | `ECS` | ✅ | ✅ |
| IoT | `IOT` | ✅ | ✅ |
| EXTC | `EXTC` | ✅ | ✅ |
| Mechanical | `MECH` | ✅ | ✅ |
| Civil | `CIVIL` | ✅ | ✅ |
| Metallurgy & Materials | `MME` | ✅ | ✅ |

> Both **Physics Cycle** and **Chemistry Cycle** templates are supported for all branches.

---

## 🔒 Privacy & Security

We take student data privacy extremely seriously.

| Aspect | How We Handle It |
|:--|:--|
| **PDF Files** | Parsed **100% locally** in your browser. Never uploaded. |
| **Raw Text** | Never saved to any server. |
| **Marks Data** | Only confirmed structured data is saved (if you choose to save). |
| **Leaderboard** | 100% opt-in. Names are masked by default. |
| **Database** | Row-Level Security (RLS) on every table. You can only see your own data. |
| **Auth** | Industry-standard OAuth 2.0 via Supabase. |
| **Guest Mode** | Use the entire app without ever creating an account. |

---

## 🚀 Deployment

<details>
<summary><strong>Deploy to Vercel (Recommended)</strong></summary>

1. Fork this repo
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your fork
4. Add environment variables
5. Deploy! ✅

**Build command:** `npm run build`  
**Output directory:** `dist`

</details>

<details>
<summary><strong>Deploy to Netlify</strong></summary>

1. Fork this repo
2. Go to [netlify.com](https://app.netlify.com/start)
3. Import your fork
4. Add environment variables
5. SPA redirects file is already included at `public/_redirects`

**Build command:** `npm run build`  
**Publish directory:** `dist`

</details>

<details>
<summary><strong>Deploy to GitHub Pages</strong></summary>

1. Enable GitHub Pages in repo settings
2. The existing workflow builds with `VITE_BASE_PATH=/<repo-name>/`
3. Keep HashRouter and add the Pages URL to Supabase redirect URLs

</details>

---

## 🤝 Contributing

Contributions are what make open source amazing! Any contributions you make are **greatly appreciated**.

1. **Fork** the repo
2. **Create** your feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Ideas for Contributions
- 🆕 Add SE (Semester 3-4) subject templates
- 🌐 Multi-language support (Hindi, Marathi)
- 📊 Historical SGPA trend analysis
- 🔔 Result notification system
- 📱 Native mobile app (React Native)

---

## 📄 Documentation

| Document | Description |
|:--|:--|
| [`LAUNCH_CHECKLIST.md`](LAUNCH_CHECKLIST.md) | Pre-launch verification steps |
| [`PARSER_NOTES.md`](PARSER_NOTES.md) | Deep dive into the gazette parser |
| [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md) | Complete Supabase configuration guide |
| [`PRIVACY.md`](PRIVACY.md) | Privacy policy |
| [`DISCLAIMER.md`](DISCLAIMER.md) | Legal disclaimer |

---

## ⭐ Star History

If this project helped you calculate your SGPA without losing your mind, consider giving it a star! ⭐

<p align="center">
  <a href="https://github.com/mitanshj07/tcet-gradecalc/stargazers">
    <img src="https://img.shields.io/github/stars/mitanshj07/tcet-gradecalc?style=for-the-badge&logo=github&color=f59e0b&labelColor=0f172a" alt="Stars" />
  </a>
</p>

---

## 📜 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  <strong>Built with ❤️ for TCET students who deserve better tools.</strong><br/>
  <sub>This is an unofficial tool and is not affiliated with or endorsed by TCET Mumbai.</sub>
</p>

<p align="center">
  <a href="https://tcet-gradecalc.vercel.app/">
    <img src="https://img.shields.io/badge/Try_it_now-tcet--gradecalc.vercel.app-0ea5e9?style=for-the-badge&logo=vercel&labelColor=0f172a" alt="Try it now" />
  </a>
</p>
