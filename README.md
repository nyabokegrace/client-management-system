# Siwolo P.O Law Advocates — Client & Case Management System (CMS)

A professional, secure, responsive internal Client and Case Management System designed for **Siwolo P.O Law Advocates**. The application streamlines client management, legal matter files, private court documents, case progress updates, court hearings calendar, task deadlines, and administrative audit trails.

---

## 1. Architecture Overview

```text
client-management-system/
├── frontend/                     # Next.js (App Router), React, TypeScript, Tailwind CSS
│   ├── app/                      # Page routes (Dashboard, Clients, Matters, Documents, etc.)
│   ├── components/               # Reusable UI components (Sidebar, Header, Modal, Badge)
│   ├── lib/                      # Centralized API client (Token Authentication)
│   ├── types/                    # Domain TypeScript interfaces
│   └── package.json
├── backend/                      # Django 5, Django REST Framework, dj-database-url
│   ├── config/                   # Django settings, URLs, WSGI, ASGI
│   ├── apps/
│   │   ├── accounts/             # Custom User model, Principal Advocate Profile & Auth
│   │   ├── clients/              # Individual & Corporate Clients, Auto-reference CLI-YYYY-####
│   │   ├── matters/              # Legal Files, Practice Areas, Auto-reference SWL-YYYY-####
│   │   ├── documents/            # Private Document Vault, Authorization checks, Protected Downloads
│   │   ├── case_updates/         # Chronological Case Progress & Proceedings narrative
│   │   ├── hearings/             # Court Diary, Mention/Trial/Ruling schedules, Outcomes
│   │   ├── tasks/                # Deadlines, Assignments, Overdue tracking
│   │   ├── audit/                # Immutable Compliance & Activity Logs
│   │   └── reports/              # Aggregated Analytics & CSV Exports
│   ├── manage.py
│   └── requirements.txt
├── .gitignore
└── README.md
```

---

## 2. Technology Stack & Design System

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide React.
- **Design Philosophy:** Restrained monochrome legal aesthetic (`#111111` Black, `#FFFFFF` White, `#F3F4F6` Light Gray, `#E5E7EB` Border, `#6B7280` Secondary Text).
- **Backend:** Python 3.12, Django 5.1, Django REST Framework 3.17, DRF Spectacular (OpenAPI 3.0), django-cors-headers.
- **Database:** PostgreSQL for production; SQLite default for isolated development & automated test suites.
- **Document Security:** Private storage outside public web roots. Files accessed strictly via authorized backend download streams (`/api/v1/documents/{id}/download/`).

---

## 3. Quick Start & Local Setup

### Backend Setup

1. **Activate Virtual Environment:**
   ```bash
   source backend/venv/bin/activate
   ```
2. **Apply Database Migrations:**
   ```bash
   python backend/manage.py migrate
   ```
3. **Seed Initial Firm Data (Single Administrator Account):**
   ```bash
   export INITIAL_ADMIN_PASSWORD="YourStrongSecurePassword"
   python backend/manage.py seed_cms
   ```
4. **Run Automated Test Suite:**
   ```bash
   python backend/manage.py test apps
   ```
5. **Start Django API Server:**
   ```bash
   python backend/manage.py runserver 127.0.0.1:8000
   ```
   - API endpoints: `http://127.0.0.1:8000/api/v1/`
   - Interactive OpenAPI documentation: `http://127.0.0.1:8000/api/docs/`
   - Django Admin: `http://127.0.0.1:8000/admin/`

---

### Frontend Setup

1. **Navigate to Frontend:**
   ```bash
   cd frontend
   ```
2. **Run TypeScript Check:**
   ```bash
   npm run type-check
   ```
3. **Run Production Build:**
   ```bash
   npm run build
   ```
4. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 4. Initial Administrator Account Setup

The system is configured for a single user (the Principal Advocate and Founder). Passwords are never hardcoded in the codebase.

Set the initial administrator password via environment variable prior to running the seed command:

```bash
export INITIAL_ADMIN_PASSWORD="YourStrongSecurePassword"
# Alternatively:
# export INITIAL_ADVOCATE_PASSWORD="YourStrongSecurePassword"
python backend/manage.py seed_cms
```

- **Username:** `admin`
- **Initial Password:** Read from `INITIAL_ADMIN_PASSWORD` (or `INITIAL_ADVOCATE_PASSWORD`)
- **Role:** Administrator (Superuser)
- The seed command creates the account if it does not exist and preserves existing credentials on subsequent executions.

---

## 5. Security & Confidentiality Safeguards

1. **No Public URLs:** Legal filings, affidavits, and contracts are uploaded to private disk storage (`backend/storage/documents/`) using randomized UUID storage keys to prevent path traversal or document identifier enumeration.
2. **Restricted Confidentiality:** Documents classified as restricted reject unauthorized access requests with an HTTP 403 Forbidden response.
3. **Audit Trail Logging:** All sensitive mutations (client registration, status updates, document uploads, file downloads, and hearings outcomes) write immutable records to the `AuditLog` table.
4. **Backend-Enforced References:** Unique identifiers (`SWL-YYYY-####` for matters, `CLI-YYYY-####` for clients) are generated atomically within database transactions on the server.
