# Family Tree Portal (Family tree)

A production-ready, privacy-preserving Family Tree management web application and genealogical portal. Built with a React (Vite) frontend and Node.js serverless API routes deployable directly on Vercel.

**Google Sheets is the ONLY database.** No SQL or MongoDB is used. There is no user login; single Admin credentials govern review and approval.

---

## Architecture & Monorepo Structure

```
family-tree-portal/
├── client/                      # React (Vite) Single Page App
│   ├── src/
│   │   ├── components/          # InteractiveTree, Modal, CaptchaWidget, StatusBadge, Navbar
│   │   ├── pages/               # HomePage, OnboardSurnamePage, AddMemberPage, RequestTicketPage, TicketStatusPage
│   │   │   └── admin/           # AdminLoginPage, AdminDashboardPage
│   │   ├── utils/               # api.js fetch wrapper
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css            # Tailwind styling
│   ├── package.json
│   └── vite.config.js
├── api/                         # Vercel Serverless Functions (Node.js 18+)
│   ├── health.js                # Schema auto-init & connection verification
│   ├── surnames.js              # Public list of approved surnames
│   ├── tree.js                  # Public hierarchical tree builder (strictly whitelisted)
│   ├── requests/
│   │   ├── index.js             # Public submission of tickets (Onboard, Add, Edit, Merge)
│   │   └── status.js            # Public ticket status tracker
│   └── admin/
│       ├── login.js             # Single admin bcrypt verification & JWT issuance
│       ├── logout.js            # Session clearance
│       ├── me.js                # Admin session verification
│       ├── dashboard.js         # Metrics (pending, duplicates, verified %, response times)
│       ├── requests.js          # Review, mail verification check, safe ID generation & approval
│       ├── duplicates.js        # Detection flags for admin resolution
│       ├── merge.js             # Soft record merge & relationship repointing
│       ├── members.js           # Directory search across families
│       ├── audit.js             # Append-only audit trail viewer
│       └── export.js            # Full database backup (JSON/CSV)
├── lib/                         # Shared Business Logic & Infrastructure
│   ├── schema.js                # Sheet tab definitions & header mapping
│   ├── security.js              # Formula injection defense & public response whitelist
│   ├── id-generator.js          # Surname Ref ID & Member Ref ID generation
│   ├── duplicates.js            # Duplicate rules & Jaro-Winkler similarity
│   ├── relationships.js         # Canonical relationship engine & graph cycle prevention
│   ├── lock.js                  # Serverless distributed locking via Google Sheets Meta tab
│   ├── cache.js                 # In-memory batch cache with TTL
│   ├── audit.js                 # Append-only audit logger
│   ├── auth.js                  # JWT token management & lockout protection
│   ├── email.js                 # Outbound email notification dispatcher
│   ├── sheets.js                # Google Sheets API client with retry and mock fallback
│   └── api-helper.js            # Serverless HTTP request helpers
├── tests/                       # Complete Unit Test Suite (22 passing unit tests)
├── dev-server.js                # Local development server bridging client and serverless API
├── vercel.json                  # Routing & build configuration for Vercel
├── .env.example                 # Environment variables template
└── package.json                 # Monorepo scripts
```

---

## Database Architecture: Google Sheets

The database uses Google Sheets API v4 with `valueInputOption: RAW`. Columns are referenced strictly by header name, never by hardcoded numerical indices.

### The 6 Tabs
1. **`Surnames`**: `surname_ref_id`, `surname_name`, `status`, `last_seq`, `created_at`
2. **`Persons`**: `person_id` (UUID), `member_ref_id`, `surname_ref_id`, `full_name`, `name_norm`, `gender`, `dob`, `is_deceased`, `email`, `email_norm`, `phone`, `phone_norm`, `father_person_id`, `mother_person_id`, `status` (Pending/Approved/Rejected/Merged), `merged_into_person_id`, `verified_by_admin`, `created_at`
3. **`Relationships`**: `rel_id`, `person_a_id`, `person_b_id`, `type` (`PARENT_OF` or `SPOUSE_OF`), `status`, `created_at`
4. **`Requests`**: `ticket_id`, `type`, `payload_json`, `requester_email`, `status`, `mail_verified`, `mail_verified_note`, `created_at`, `decided_at`, `admin_remarks`
5. **`AuditLog`**: Append-only log recording all creations, approvals, rejections, merges, and ID generation events. Rows are never updated or deleted.
6. **`Meta`**: Distributed mutex lock row (`lock_key`, `acquired_by`, `expires_at`) for safe serverless concurrent ID assignment and `schema_version`.

### Security Protections
- **Formula Injection Defense**: Strips leading `= + - @ \t \r` characters from all user inputs.
- **Strict Public Whitelist**: Public endpoints (`/api/tree`, `/api/surnames`) strictly filter out email addresses, phone numbers, and dates of birth. Only `full_name`, `member_ref_id`, `gender`, and calculated relative relations are visible publicly.

---

## Setup & Configuration

### 1. Google Cloud Service Account Setup
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `Family Tree Portal`.
3. Enable the **Google Sheets API**.
4. Go to **APIs & Services > Credentials**, click **Create Credentials > Service Account**.
5. Grant the service account the role of **Editor**.
6. Under the **Keys** tab, click **Add Key > Create new key > JSON**. Download this file.
7. Create a new Google Spreadsheet in Google Drive. Copy its Spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`
8. Share the Google Spreadsheet with the service account client email (e.g. `your-sa@project-id.iam.gserviceaccount.com`) as **Editor**.
9. Base64-encode the downloaded JSON key file:
   ```bash
   # Linux/macOS
   base64 -w 0 credentials.json
   # Windows PowerShell
   [Convert]::ToBase64String([System.IO.File]::ReadAllBytes("credentials.json"))
   ```

### 2. Environment Variables (.env)
Create a `.env` file in the root directory:
```env
PORT=3001
NODE_ENV=development

# Google Sheets Configuration
GOOGLE_SHEET_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_JSON=eyJhbGciOi... # Base64 encoded service account json

# Single Admin Account
ADMIN_EMAIL=admin@familytree.local
# Generate hash using: node -e "console.log(require('bcryptjs').hashSync('YourStrongPassword', 10))"
ADMIN_PASSWORD_HASH=$2a$10$N9qo8uLOickgx2ZMRZoMye.I...
JWT_SECRET=super_secret_jwt_random_string_32_chars_min

# Email & Verification
SUPPORT_EMAIL=support@familytree.local
RECAPTCHA_SECRET=mock-token
```

---

## Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   npm --prefix client install
   ```

2. **Run tests**:
   ```bash
   npm test
   ```
   All 22 unit test suites will execute and verify surname generation, sequential locks, relationship validation, duplicate detection, and public whitelisting.

3. **Start local development server**:
   ```bash
   npm run dev
   ```
   - Local API and dev proxy run at `http://localhost:3001`
   - Client dev server runs at `http://localhost:5173`

---

## Deploying to GitHub

1. Ensure Git is available in your shell.
2. Initialize and commit the project:
   ```bash
   git init
   git add .
   git commit -m "feat: complete Family tree portal with Google Sheets database"
   ```
3. Create a new repository on [GitHub](https://github.com/new) named `family-tree`.
4. Link remote and push:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/family-tree.git
   git branch -M main
   git push -u origin main
   ```

---

## Deploying to Vercel

1. Log in to [Vercel](https://vercel.com).
2. Click **Add New > Project** and select your GitHub repository `family-tree`.
3. In Project Settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `client/dist`
4. In **Environment Variables**, add:
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_JSON` (Base64 string)
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD_HASH`
   - `JWT_SECRET`
   - `SUPPORT_EMAIL`
   - `RECAPTCHA_SECRET`
5. Click **Deploy**. Vercel will build the React frontend and deploy the serverless functions in `/api`.

---

## Automated Backup Routine

To perform daily offsite backups of all 6 Google Sheets tabs, run a scheduled cron task:
```bash
curl -s -H "Authorization: Bearer <ADMIN_JWT>" "https://your-domain.vercel.app/api/admin/export?format=json" > "backup-$(date +%F).json"
```
Or download the JSON / CSV export directly from the Admin Dashboard **Export Backup** tab.

