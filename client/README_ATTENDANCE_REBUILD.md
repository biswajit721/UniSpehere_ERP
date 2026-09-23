# UniSphere ERP — Attendance UI Rebuild (client)

This document covers the frontend changes. See `../server/README_ATTENDANCE_REBUILD.md` for the
backend side — the two must be deployed together; this client calls the new API routes described
there.

## 1. What was broken

The old `TakeAttendance.tsx` pre-selected `"2026-2027"` and `"Semester 1"` as component state
defaults, showed a permanent "Loading…" for Department/Program (because the API never sent
`faculty.departmentId`), listed six hard-coded periods, and had no "Number of classes" field. There
was no HOD analytics screen, and the Students page could silently overwrite a student's semester.

## 2. What's new

- **Take Attendance** (`features/attendance/TakeAttendance.tsx`) — nothing is pre-selected; every
  dropdown is disabled with a "Select X first" placeholder until its parent is chosen, and shows
  Loading… / Error + Retry / No data found states. Cascades through Session → Semester → Department
  → Program → Section → Subject → Date → Period → Number of classes → Start/End time, all from the
  real API. Loads the roster, defaults everyone to **Absent**, has Select-all-present / Mark-all-
  absent that respect the current search filter, live Present/Absent/Total/% counters, a confirmation
  dialog, and a success card with the attendance ID.
- **Records** (`features/attendance/AttendanceRecords.tsx` +
  `AttendanceDetailModal.tsx`) — view any submitted sheet, correct it (status change requires a typed
  reason ≥ 3 characters, shown with a full edit trail per student), or cancel it (HOD/admin), and
  download a per-class PDF.
- **Analytics** (`features/attendance/AttendanceAnalytics.tsx`) — HOD/admin dashboard: overall,
  semester-wise, section-wise, subject-wise, faculty-activity, and a paginated "students below
  threshold" list with CSV export.
- **My Attendance** (`features/attendance/MyAttendance.tsx`) — the student's own view: Overview /
  Daily / Weekly / Monthly / Yearly / Semester / Academic-session lenses, and a shortage calculator
  ("attend the next N classes in a row to reach 75%" / "you can still miss N and stay above it").
- **Academic Record** (`features/students/AcademicRecordModal.tsx`) — replaces the old in-place
  semester editor. Shows the full enrollment history as a timeline and exposes Promote / Readmit ·
  Repeat / Change section / Defer · Withdraw as explicit, audited actions, plus backlog/elective
  subject registration.
- **Academics** (`pages/AcademicsPage.tsx` + `features/academics/*`) — Subjects (with a "needs
  linking" flow for legacy subjects), Faculty assignments, Academic sessions, and the Period grid
  editor.
- **Student registration** (`features/users/CreateUserModal.tsx`) — now asks for the academic
  session, admission type (regular/lateral), and semester (filtered to what that admission type
  allows) as part of registering a student, instead of only creating a bare user record.

## 3. Design system / dark mode / responsiveness

- All colour is driven by CSS variables in `src/index.css` (`--bg`, `--card`, `--ink`, `--primary`,
  status colours, per-module accents), each with a light and a `.dark` value, wired into
  `tailwind.config.js`. Nothing in the app hard-codes a hex colour for text/background any more
  (verified — see below); the small number of legacy pages that used ad hoc
  `bg-success/10 text-success`-style status pills were switched to the same calibrated tokens the
  new badge components use.
- Shared primitives in `src/components/ui/`: `Modal` (focus trap, Escape, scroll lock, becomes a
  bottom sheet on phones), `SelectField` (the loading/error/empty/waiting states used everywhere),
  `Tabs`, `Toaster`, `ThemeToggle`, `Feedback.tsx` (`Alert`, `Spinner`, `EmptyState`, `PageHeader`,
  `StatTile`).
- `src/store/themeStore.ts` persists the choice, follows the OS theme until the person picks one
  explicitly, and `index.html` applies it before first paint (no flash of the wrong theme).
- Layout uses `100dvh` and `env(safe-area-inset-*)` throughout, a slide-in drawer nav under `lg:`,
  and the attendance roster becomes cards (not a squeezed table) on phones with a sticky
  present/absent/submit bar that never overlaps the floating chat button.
- `useChartTheme()` (`src/utils/useChartTheme.ts`) reads the same CSS variables so every `recharts`
  chart (new and pre-existing) follows light/dark automatically.

I audited every page in both themes with `axe-core`'s colour-contrast rule via a headless-browser
script (not included in this zip — it's a throwaway test harness, not app code). Result: **0
contrast violations** across every audited page/role in both light and dark, versus **185 (light) /
953 (dark)** on the original build.

## 4. Running it

```bash
cd client
npm install
cp .env.example .env       # VITE_API_URL should point at the server (see server/README)
npm run dev
```
Build: `npm run build`. Typecheck: `npx tsc --noEmit`.

## 5. Known caveats

- The Timetable page's own form doesn't yet pick start/end times from the new Period grid (it still
  takes free-typed times) — the *attendance* screen does read the grid correctly; wiring the
  Timetable form to it as well is a natural follow-up.
- The Departments page UI wasn't changed; a program's `Semester` rows (now created automatically) are
  only visible through the Academics screen and the API, not yet listed inline on the Departments page.
