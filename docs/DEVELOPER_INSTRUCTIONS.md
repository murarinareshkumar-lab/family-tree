# FAMILY TREE PORTAL
## DEVELOPER INSTRUCTIONS & MASTER IMPLEMENTATION PROMPT
### Antigravity IDE Development Baseline | PRD & FSD v4.0

---

### 1. Architectural Lessons Learned & Previous Errors Addressed

Before making any changes, every developer and agent must understand the past production issues and architectural constraints:

1. **Vercel Hobby Plan Function Limit (Max 12 Serverless Functions)**:
   * **Previous Error**: Creating separate files in `/api` (such as `api/surnames/search.js`, `api/requests/index.js`, etc.) created 17 functions, exceeding the Hobby plan limit. Vercel failed the serverless build and served plain-text `404 NOT_FOUND` responses.
   * **Mandatory Architecture**: All API routes must remain consolidated into **ONE single Express application** exported from `api/index.js`.
   * **Route Placement**: All route handlers reside in `server/routes/*.js`. Only `api/index.js` exists in the `/api` folder.
   * **Dual Mount**: In `server/app.js`, mount the API router on both `/api` and `/` so requests resolve seamlessly regardless of whether Vercel rewrite rules strip the prefix.

2. **Repository Structure & Duplication**:
   * **Previous Error**: `scripts/build.js` previously copied `api/`, `server/`, and `lib/` into `client/`, causing confusing duplicate files.
   * **Current Rule**: The root directories (`/api`, `/server`, `/lib`) are the sole authoritative backend source. `client/` is dedicated to the Vite React frontend.

3. **Test Suite Independence (Zero Live Credentials Requirement)**:
   * **Previous Error**: Running tests locally or in CI without Google service account credentials caused `DECODER routines::unsupported` errors.
   * **Mandatory Rule**: `lib/sheets.js` provides `InMemorySheetsProvider`. When `NODE_ENV === 'test'`, `getSheetsClient()` automatically returns `InMemorySheetsProvider`. The entire test suite (`npm test`) must pass without live credentials.

4. **Member Reference Format (PRD v4.0)**:
   * **Format**: `SS-FFF-MMYYYY-NNN` (e.g. `MU-NAR-071995-001`).
   * **Specification**: Generated only upon Admin approval under the `ID_LOCK`. Permanent and never reused.

5. **A4 Duplicate Warning vs Hard Block**:
   * **Rule**: Exact First Name + Middle Name + Last Name + DOB match within the selected family is an **A4 Warning** (not a hard block).
   * **UI Action**: Display warning with "Go Back" and "Proceed Anyway" options. If "Proceed Anyway" is selected, persist this choice in the request payload for Admin review.
   * **Hard Block**: Exact duplicate adult email is an immediate hard block. Duplicate phone is a hard block.

6. **Different-Surname Link Flow**:
   * **Approved Sequence**: Family -> Person -> Relationship. The earlier Surname -> Family step is superseded.

7. **Public Privacy (Names Only)**:
   * Public APIs and UI components must never expose gender, member references, family references, DOB, email, phone, or status.
   * Tree nodes use throwaway node IDs (`node_<hex>`).

---

### 2. Master Implementation Prompt for Antigravity IDE

```text
You are an expert full-stack engineer working in the Family Tree Portal repo (Node.js/Express backend + React Vite frontend + Google Sheets persistence).

Your objective is to implement the Family Tree Portal according to PRD v4.0 and FSD v4.0 while respecting all architectural constraints and past operational lessons.

CRITICAL ARCHITECTURAL CONSTRAINTS:
1. Vercel Hobby plan limit: Keep EXACTLY ONE serverless function in /api (api/index.js exporting server/app.js). All routes live in server/routes/*.
2. No duplicate directories in client/. Root /api, /server, /lib are authoritative.
3. Dual-mount all Express routes under /api and / to prevent Vercel rewrite 404s.
4. Tests must run without live Google credentials via InMemorySheetsProvider.
5. Member Reference format is SS-FFF-MMYYYY-NNN (e.g. MU-NAR-071995-001), assigned on Admin approval under ID_LOCK.
6. A4 duplicate identity (Name + DOB in family) is a WARNING with Go Back and Proceed Anyway; adult email duplicate is a HARD BLOCK.
7. Different-surname link sequence is Family -> Person -> Relationship.
8. Public privacy: Names only. Throwaway node IDs (node_<hex>), zero reference IDs or gender badges in public responses.
9. Email OTP module in lib/otp.js with HMAC-SHA256 hashing in Otp tab. 6 digits, 5-minute expiry, 30s resend gap, 3 resends max, 5 attempts max.
10. Do not use em dashes or en dashes in any text, code comments, UI strings or docs. Use plain sentences.

IMPLEMENTATION PHASES:
Phase 1: Update id-generator.js to support SS-FFF-MMYYYY-NNN format and add comprehensive tests.
Phase 2: Implement lib/otp.js with HMAC hashing, resend limits, and verification tokens. Add /api/otp/send and /api/otp/verify endpoints.
Phase 3: Integrate OTP verification and A4 duplicate warning into server/routes/requests.js and client forms.
Phase 4: Implement screen sequences in client: Add Members (Related To any approved person), Same-Surname Link, Different-Surname Link (Family -> Person -> Relationship).
Phase 5: Update Admin queues with A4 warning context, phone verification fallback, and approval state machine.
Phase 6: Run full test suite (npm test) and build (npm run build). Ensure 100% pass rate.
```

---

### 3. Step-by-Step Development & Verification Guide

#### Step 1: Member Reference ID Generation (`lib/id-generator.js`)
* Update `generateMemberRefId` to construct `SS-FFF-MMYYYY-NNN`:
  * `SS`: First 2 letters of surname normalized to uppercase `[A-Z]`. Pad with `X` if fewer than 2 letters.
  * `FFF`: First 3 letters of first name normalized to uppercase `[A-Z]`. Pad with `X` if fewer than 3 letters.
  * `MMYYYY`: Month and 4-digit year from DOB (`YYYY-MM-DD` or `DDMMYYYY`). Default to `000000` if unknown.
  * `NNN`: 3-digit sequence starting at `001`. Calculate from existing approved IDs sharing the same prefix.
* Update `tests/id-generator.test.js` to assert the `SS-FFF-MMYYYY-NNN` pattern.

#### Step 2: Real Email OTP Module (`lib/otp.js` & `server/routes/otp.js`)
* Schema: Add `Otp` tab to `lib/schema.js`:
  `HEADERS.Otp = ['otp_id', 'purpose', 'email_norm', 'request_ref', 'code_hash', 'expires_at', 'attempts', 'resends', 'last_sent_at', 'status']`
* Core functions in `lib/otp.js`:
  * `hashOtpCode(code, email, purpose)`: HMAC-SHA256 using `JWT_SECRET`.
  * `createAndSendOtp({ email, purpose, request_ref, sheetsClient })`: Enforces 30s resend gap, 3 resends max, cancels previous active codes, generates 6-digit code, saves HMAC hash.
  * `verifyOtp({ email, purpose, code, sheetsClient })`: Enforces 5-minute expiry, 5 attempts max, marks status `VERIFIED`, issues signed JWT verification token.
  * `verifyVerificationToken(token, expectedPurpose, expectedEmail)`: Validates JWT token on request submission.
* Endpoints:
  * `POST /api/otp/send` -> Always returns `{ ok: true, message: 'If this email is registered, a code has been sent.', resendAfterSeconds: 30 }`.
  * `POST /api/otp/verify` -> Returns `{ ok: true, verified: true, token }`.

#### Step 3: Duplicate Engine & A4 Warning
* Update `lib/duplicates.js`:
  * `checkExactEmailDuplicate`: Hard block if adult email matches any approved or pending record.
  * `checkExactPhoneDuplicate`: Hard block if phone matches.
  * `checkA4FamilyMatch(newPerson, familyPersons)`: Returns `{ warning: true, message: 'A person with the same details already exists in this family.' }` if First Name + Middle Name + Last Name + DOB match.
* Update `client/src/pages/OnboardSurnamePage.jsx` and `AddMemberPage.jsx` to render the A4 Warning dialog with "Go Back" and "Proceed Anyway".

#### Step 4: Screen Sequences & Card Actions
* **Family Card Actions** on `OnboardSurnamePage.jsx`:
  * Add Members: Carries selected family context, presents Related To dropdown with all approved members, then Relationship dropdown.
  * Link Same-Surname Family: Select approved person in same surname -> Select Relationship.
  * Link Different-Surname Family: Select target Family -> Select approved Person -> Select Relationship.
* Ensure relationship semantics are always: `New/Linking person -> Relationship -> Selected person`.

#### Step 5: Master Admin Review & Phone Verification Fallback
* Update `server/routes/admin-requests.js`:
  * Display A4 duplicate warnings and the user's "Proceed Anyway" confirmation.
  * Support `RECORD_PHONE_VERIFICATION` action for elders, minors, or deceased individuals without email.
  * Approval requirement: Enforce that all living adults have verified status (OTP token or recorded Admin phone call).

#### Step 6: Testing & Verification Checklist
1. `npm test`: Verify that all test suites pass without network or credential errors.
2. `npm run build`: Verify that Vite compiles without warnings and output exists in `dist/`.
3. Check `api/` directory: Ensure only `api/index.js` is present (exactly 1 function).
4. Verify response whitelisting: Confirm that public tree and search responses never return private fields or reference codes.
