# UniSphere ERP — Phase 2 & 3: Database Schema + Auth/RBAC Foundation

This delivers the foundation everything else builds on: the core Prisma schema
(Users, Roles, Permissions, Departments, Programs, Batches, Sections, Students,
Faculty) and a fully working Auth module (JWT access + refresh tokens, bcrypt
hashing, database-driven RBAC, login activity + audit logging) — plus a
connected React frontend with a login page and role-based dashboard shell.

## Run the backend

```bash
cd server
cp .env.example .env        # fill in DATABASE_URL, JWT secrets, and see below
npm install
npx prisma migrate dev --name init
npm run prisma:seed         # creates roles, permissions, and a super admin
npm run dev                 # http://localhost:5000
```

### New in this update: real third-party credentials

Add these to `server/.env` to enable the features below. The app still runs
without them — each feature fails gracefully with a clear error (or, for
email, prints the OTP to your server console instead of sending it).

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

SMTP_HOST=smtp.gmail.com        # or your provider
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your_app_password     # not your regular password - use an app password
SMTP_FROM="UniSphere ERP <you@gmail.com>"

GEMINI_API_KEY=your_gemini_api_key
```

- **Cloudinary** powers Profile Photos and the Document Vault (file uploads
  go straight to Cloudinary, never touch your server's disk)
- **SMTP** powers the Forgot Password email OTP. Without it, the OTP is
  printed to your server terminal instead — useful for local testing
- **Gemini** powers the AI Performance Tips on the student Analytics page.
  Without it, a rule-based fallback tip is shown instead (clearly labeled
  as non-AI)

Seeded login: `superadmin@unisphere.edu` / `ChangeMe@123` (forces password
reset on first login via `mustResetPassword`).

## Run the frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

## What's working right now

- Login (email or university ID) → JWT access token (15m, httpOnly cookie) +
  refresh token (7d, httpOnly cookie, stored & revocable in DB)
- Automatic silent refresh on 401 via an axios interceptor
- `authenticate` middleware (verifies JWT) + `authorize(module, action)`
  middleware (checks the `Permission` table — add/remove access by editing
  rows, not code)
- Change password, logout (revokes refresh token), login activity log, audit
  log entries
- Role-based sidebar navigation (11 roles including Principal, added later)
  with your module color mapping applied
- Dark mode toggle wired to the full palette from the architecture doc
- **Users** — Super Admin / University Admin can create accounts for any role,
  auto-generated University ID, one-time temporary password
- **Departments** — full CRUD tree: Department → Program → Batch → Section
- **Students / Faculty** — searchable, filterable lists; edit key fields;
  suspend/activate accounts
- **Academics** — Subject CRUD (name, code, credits, semester, type,
  department, assigned faculty)
- **Attendance** — faculty picks subject + section + date, marks
  Present/Absent/Late per student; students see their own subject-wise
  attendance percentage with a "Low" flag under 75%
- **Examination** — Exam Controller creates exams and publishes results;
  faculty enter marks for their own subjects; students see published results
  with an auto-calculated percentage and grade (O/A+/A/B+/B/C/F)
- **Fees** — Accountant creates fee records (tuition/exam/hostel/transport/
  other) and records payments with auto-generated receipt numbers and status
  (Pending/Partial/Paid); students see their own dues
- **Timetable** — HOD/Admin builds the weekly schedule per section with
  automatic conflict detection (blocks double-booking a faculty member or a
  section); faculty and students see their own personal timetable
- **Library** — Librarian manages the book catalog and issues/returns books
  with automatic overdue fine calculation (₹5/day); students and faculty
  browse the catalog, students track their own issued books and fines
- **Placement** — Placement Officer manages companies and drives (with
  eligibility rules: department restriction, minimum CGPA) and reviews
  applicants (Applied/Shortlisted/Selected/Rejected); students see open
  drives they're eligible for, apply, and track their application status
- **Settings** — every role can view their profile and change their own
  password
- **Super Admin password reset** — from the Users page, reset the password
  for any account (student, faculty, any role); generates a new temporary
  password, forces a reset on next login, and revokes existing sessions
- **Real dashboard data** — role-aware stats (total students/faculty/
  departments for admins, attendance % and pending fees for students,
  subject/exam counts for faculty, etc.) pulled live from the database
- **Notices** — staff (Admin/HOD/Principal) post announcements targeted to
  everyone, a specific role, or a department; everyone sees only what's
  relevant to them
- **Notifications** — a bell in the header with unread count, polling every
  30s; fed automatically by Notices (fan-out on posting), Leave decisions,
  and Grievance status changes
- **Leave Management** — students/faculty apply for leave; HOD/Admin see a
  pending queue and approve or reject with a note, which notifies the
  applicant
- **Grievance** — anyone can raise a ticket (Academic/Hostel/Technical/
  Infrastructure/Other); HOD/Admin manage status (Open → In Progress →
  Resolved/Closed) with a resolution note, which notifies the person who
  raised it
- **Administration** — Super Admin can view the system-wide audit log
  (filterable by module), now populated by real actions like user creation
  and password resets, not just login events
- **Profile photos** — everyone can upload a profile photo (Cloudinary-backed),
  shown in the header and Settings
- **Personal details** — everyone can view and edit their own phone, date of
  birth, gender, address, and bio from Settings; Super Admin/University Admin
  can view and edit any user's details via the Users API
- **Forgot password (email OTP)** — 3-step flow: request a code by email,
  verify the 6-digit code, set a new password. Falls back to printing the
  code to the server console if SMTP isn't configured
- **Document Vault** — upload certificates/marksheets/ID proofs/resumes to
  Cloudinary; Super Admin/University Admin verify or reject each one
- **My Performance (Analytics)** — students see real charts: average score
  per subject (bar), a "career trend" of exam performance over time (line),
  and monthly attendance percentage (bar) — all computed from actual
  Marks/Attendance records, not sample data
- **AI Performance Tips** — Gemini-generated, personalized improvement tips
  based on the student's real weak subjects and attendance; falls back to a
  clear rule-based tip if Gemini isn't configured or the call fails

## What's next

Hostel management, Digital ID Card, and Report generation (PDF/Excel) are
the remaining modules from the original spec — none of them are built yet.
