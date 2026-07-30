# BodyIQ HQ

Private management console for Body IQ. This is a completely separate
codebase and deployment from the public Body IQ application — no shared
repo, no shared Netlify site, no shared data.

**Status: all nine phases complete.**

| Phase | Area | What it does |
|---|---|---|
| 1 | Architecture | Folder structure, RLS-first security model, hash routing |
| 2 | Authentication | One-time admin setup, login, session persistence, guards |
| 3 | Dashboard Layout | Collapsible sidebar, mobile drawer, fixed header, empty/loading states |
| 4 | Analytics | Visitor/BMI-calculation/report-download counts, 30-day growth chart |
| 5 | Content Management | Wellness tips, reflection templates, insights, announcements, PDF footer |
| 6 | Insights | Most common BMI category, top goal, average wellness score, completion rate |
| 7 | Settings | Profile, password change, maintenance mode, feature flags |
| 8 | Security | Failed-login lockout, login activity log, inactivity timeout, 2FA groundwork |
| 9 | Application Health | Live Supabase/analytics/content checks, deployment info |

## One-time setup (before first deploy)

1. **Create a Supabase project** at https://supabase.com — free tier is fine.
2. **Run the schema.** Open the SQL editor in your Supabase project and run
   the full contents of `supabase/schema.sql` top to bottom — it's written
   as one running migration log across all nine phases, safe to run in order.
3. **Get your project's API credentials.** In Supabase: Settings -> API.
   You'll need the "Project URL" and the "anon public" key (not the
   `service_role` key — that one must never appear in this codebase).
4. **Set environment variables:**
   - Locally: copy `.env.example` to `.env` and fill in the two values.
   - On Netlify: Site settings -> Environment variables -> add
     `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
5. **Deploy to Netlify** (or run `npm run build` locally, which writes
   `src/config.js`, then open `index.html`).
6. **Create your administrator account** — the app automatically shows the
   Setup page on first load, since no admin exists yet.
7. **Important manual step after setup:** in your Supabase dashboard, go to
   Authentication -> Providers -> Email and turn **off** "Enable Sign Up".
   This closes public registration at the project level, not just in this
   app's UI — see the comment near the top of the admins table section in
   `schema.sql` for why this step can't be automated from the frontend.
8. **Configure the public Body IQ site.** Open `analytics.js` and
   `dynamic-content.js` in the Body IQ project and fill in the same
   `SUPABASE_URL` / `SUPABASE_ANON_KEY` values from step 3. Without this,
   Body IQ works completely normally but nothing shows up in Analytics,
   Insights, or Content — see Body IQ's own README for detail.

## Why the app can't fully self-configure step 7

Disabling sign-ups project-wide requires Supabase's dashboard or the
Management API with a personal access token — neither of which should ever
be reachable from a public, anon-key-authenticated frontend. The `admins`
table's row-level security policy (in `schema.sql`) already makes a second
admin account impossible at the database level regardless of this setting;
toggling sign-ups off is an extra layer of defense at the project level.

## Architecture notes

- **No framework.** Plain HTML/CSS/JS with native ES modules — no bundler
  needed to run it, only a tiny Node script at build time to inject config.
- **Hash-based routing** (`#/login`, `#/dashboard`, etc.) — works on Netlify
  with zero redirect configuration for sub-routes.
- **Row Level Security is the real security boundary**, not the anon key.
  Every table's access rules live in `schema.sql`, enforced by Postgres.
  Several tables (`login_attempts`) have *no* direct grants at all — access
  only through narrow `SECURITY DEFINER` functions, so even the anon role
  can never read raw rows, only call a function that returns a boolean or
  a count.
- **`src/config.js` is gitignored** and generated at build time by
  `scripts/generate-config.js` from Netlify environment variables. It is
  currently checked into this handoff as a placeholder for convenience —
  replace it with real values (or run `npm run build` with a `.env` file)
  before this will actually connect to your Supabase project.
- **Every page renders through `renderAppShell()`** (sidebar + header +
  mobile drawer + inactivity timeout, all in one place) — adding a future
  Phase Ten page means one new file in `src/pages/` plus one line in
  `main.js`, not touching navigation code.

## Known open decisions (not yet resolved, deliberately)

- **Wellness Tips and Reflection Templates** (Content Management) aren't
  wired into the public site's recommendation engine yet. Doing so needs a
  design decision — do admin-authored tips replace, supplement, or rotate
  alongside the existing rule-based cards? Reflection templates raise the
  same question for `buildBodyReflection()`. The CMS itself is fully built
  and ready the moment that's decided.
- **Feature flags** (Settings) are a real, working add/toggle/delete list,
  but none are currently read by the public site — none were named in the
  original spec, so none were invented to fill the space.
