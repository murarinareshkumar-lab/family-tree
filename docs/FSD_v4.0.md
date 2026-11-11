# FAMILY TREE PORTAL
## FUNCTIONAL SPECIFICATION DOCUMENT (FSD)
### Version 4.0 | 11 November 2026 | Working Baseline

---

### 1. Document Control

| Item | Value |
| :--- | :--- |
| Document | Family Tree Portal - Functional Specification Document |
| Version | 4.0 |
| Date | 11 November 2026 |
| Status | Working Baseline |
| Basis | Family Tree Portal PRD v4.0, source V2.1, use cases and explicit owner decisions |
| Implementation baseline | Vercel + Google Sheets |
| Authoritative decision | Single Master Admin |
| Relationship master data | TBD - owner supplied |

This FSD converts the approved product requirements into screen behavior, functional flows, validations, request states, data rules, logical APIs, storage expectations, audit behavior and acceptance-level implementation detail. Exact endpoint paths and sheet-column names remain implementation decisions unless explicitly fixed below.

---

### 2. System Context

The portal is a public-facing web application. Visitors do not authenticate to browse approved family information. Protected actions use request-specific email OTP verification. The Master Admin uses a protected authenticated area. Google Sheets is the data persistence baseline and Vercel is the hosting baseline.

---

### 3. Functional Modules

| Module | Functions |
| :--- | :--- |
| Public Search | Surname search, approved-family cards, family selection. |
| Family Onboarding | Founding family registration and family identity determination. |
| Member Onboarding | Add new person, join existing family, reusable Member Details form. |
| Existing Person Link | Link an already-approved person into a family/relationship. |
| Family Link | Same-surname and different-surname family connection flows. |
| Delink | Remove an approved family connection without deleting the person. |
| Verification | Email OTP, responsible-contact verification, request verification. |
| Duplicate Engine | Email/phone hard blocks and A4 identity warning. |
| Request/Ticket | Ticket creation, status, parent/child ticket support. |
| Family Confirmation | Up to three supporting family confirmation requests. |
| Admin | Queues, review, approval/rejection, directory, audit, backup. |
| Public Tree | Names-only family tree and connected-family navigation. |

---

### 4. Navigation & Screen Specifications

#### 4.1 Surname Search
* Input: Surname.
* Minimum 3 characters.
* Case-insensitive; Unicode supported.
* Search returns approved families only.
* Pending requests never appear.
* If no family is found, provide the founding-family pathway.
* If families are found, render one family card per distinct approved family.

#### 4.2 Family Card
* Card represents the complete family, not only the founding couple.
* Show couple rows with Husband Name and Wife Name.
* 10 rows per page with pagination.
* Show only approved couple relationships.
* Public display contains names only.
* Do not expose DOB, phone, email, Member Reference or Family Reference.
* Actions are placed at family-card level:
  * Add Members
  * Link Same-Surname Family
  * Link Different-Surname Family

#### 4.3 Add Members - First Screen
* Retain selected family as context.
* Display approved members of that family in Related To / Person selection.
* Allow user to select any one approved person.
* Display Relationship dropdown from Relationship Master Data.
* Interpret selection as: New person -> Relationship -> Selected person.
* On Continue, open the separate Member Details/onboarding form.

#### 4.4 Link Same-Surname Family - First Screen
* Open the same-surname link page.
* Display approved members in the applicable same-surname family context.
* User selects one person.
* User selects Relationship.
* Interpret as: New/Linking person -> Relationship -> Selected person.
* No person record is created by this selection.

#### 4.5 Link Different-Surname Family - First Screen
* Open Different-Surname Family link page.
* Display Family dropdown for the available target family context.
* User selects Family.
* Display approved members of the selected family.
* User selects Person.
* User selects Relationship.
* Interpret as: New/Linking person -> Relationship -> Selected person.
* Continue to verification/ticket/family-confirmation/Admin flow.
* Approved sequence: Family -> Person -> Relationship. The earlier Surname -> Family sequence is superseded for this flow.

---

### 5. Reusable Member Details Form

| Section | Field | Required / Rule |
| :--- | :--- | :--- |
| Person | Surname | Required; derived from approved search/family context where applicable. |
| Person | First Name | Required; Unicode letters only. |
| Person | Middle Name | Optional; Unicode letters only. |
| Person | Last Name | Required; Unicode letters only. |
| Person | Gender | Required; final master values TBD. |
| Person | DOB | Required for normal records; valid past date; minor DOB mandatory. |
| Person | Status | Required: Alive / Deceased. |
| Person | Date of Death | Required for Deceased; cannot be future. |
| Marital | Marital Status | Conditional; master values TBD. |
| Marital | Surname Before Marriage | Conditional. |
| Marital | Surname After Marriage | Conditional. |
| Marital | Marriage Date | Conditional; valid date. |
| Contact | Email | Living adult: mandatory and OTP verified. |
| Contact | Phone | Living adult: mandatory; duplicate rules apply. |
| Contact | OTP | Verification transaction; never store raw OTP. |
| Relationship | Related To | Approved existing member for new-member/link flows. |
| Relationship | Relationship | Master Data value; final list TBD. |
| Responsible Contact | Parent/Guardian | Required for applicable minors. |
| Responsible Contact | Parent/Guardian Email | Used for verification where applicable. |
| Additional | Occupation | Admin-managed master list. |
| Additional | Location | Structure TBD. |
| Additional | Photo | Phase 2; source limit JPEG/PNG up to 3 MB. |
| Requester | Name / Phone / Relationship | Required for protected request context. |
| Requester | Email / OTP | Required for requester verification. |
| Review | Warnings / Consent / Submit | Required at final submission. |

#### 5.1 Founding Member Initial Capture
* First Name, Middle Name, Last Name, DOB, Phone and Email.
* Multiple founding members may be added using + Add Founding Member.
* Living adult founding members require applicable OTP verification.
* Detailed profile completion is a separate later flow.

---

### 6. Validation Specification

#### 6.1 Name Validation
* First Name and Last Name mandatory for normal records.
* Middle Name optional.
* Letters only with Unicode support (Kannada, Hindi, Telugu, etc.).
* Regex: `/^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u`.
* Trim leading and trailing whitespace.
* Client validation is advisory; server validation is authoritative.

#### 6.2 DOB & Status
* Reject future DOB. Year 1900 or later for modern records.
* Minor DOB is mandatory.
* Date of Death is mandatory when Status = Deceased.
* Reject future Date of Death.
* Year-only or unknown date support may be used only for approved elder/deceased exception cases.

#### 6.3 Relationship Validation
* Selected Related To person must exist and be Approved.
* Reject self-link.
* Reject ancestor loops (cycle detection).
* Maximum one father and one mother per person.
* Spouse must be reciprocal.
* Parent must be at least 12 years older than child when DOB is known.
* Apply final gender constraints where defined.
* Reject duplicate existing or pending relationship.

#### 6.4 Duplicate Validation
| Rule | System behavior |
| :--- | :--- |
| Exact adult email duplicate | Hard block; do not issue OTP for the blocked creation request. |
| Duplicate phone | Hard block according to owner-finalized rule. |
| Exact First+Middle+Last+DOB within selected family | A4 warning; show Go Back and Proceed Anyway. |
| No exact A4 match | No A4 warning. |
| A4 Proceed Anyway | Persist warning/proceed decision for Admin review. |
| Pending matching request | Consider during duplicate/identity validation. |
| Approval recheck | Repeat critical duplicate checks before official creation. |

#### 6.5 OTP Specification
* Generate a fresh 6-digit OTP per protected request.
* Store only an HMAC-SHA256 hash of the code; never expose raw OTP in logs or storage.
* 5-minute expiry, 30-second resend gap, 3 resends maximum, 5 verification attempts.
* Requester OTP and new-adult OTP are distinct verification events.
* OTP success marks verification only; it does not create official status.
* Minor verification uses parent/guardian email where applicable.
* Deceased workflow does not require personal email or phone.

---

### 7. Detailed Workflow Specifications

#### 7.1 Founding Family Workflow
1. User enters surname and searches.
2. System returns no approved family.
3. User starts founding-family registration.
4. User captures founding husband/wife core details.
5. System validates fields and duplicate conditions.
6. Applicable living adults complete OTP verification.
7. System creates request ticket.
8. Admin reviews concurrent same-surname requests.
9. Admin determines whether request creates a new family identity.
10. On approval, System creates Family Reference and Member References.
11. System records audit event and sends confirmation.

#### 7.2 Add Member Workflow
1. User opens Add Members from a selected family card.
2. System retains family context.
3. User selects any approved Related To member.
4. User selects Relationship.
5. System validates selection.
6. System opens Member Details form.
7. User enters new person details.
8. System runs applicable verification and duplicate checks.
9. Requester completes fresh OTP at submission where required.
10. System creates ticket.
11. Family confirmation is collected where applicable.
12. Admin approves or rejects.
13. On approval, System creates official Member Reference and relationship.
14. Audit and confirmation are written.

#### 7.3 Link Existing Person Workflow
1. User selects existing approved person.
2. User selects Relationship.
3. System validates person and relationship.
4. Requester completes applicable OTP.
5. System checks duplicate pending/approved relationship.
6. System creates ticket.
7. System selects up to three eligible family confirmation recipients.
8. Recipients may Confirm or Reject.
9. Admin reviews evidence and makes final decision.
10. On approval, create family connection only; do not create a person record.

#### 7.4 Delink Workflow
1. User selects existing approved connection.
2. System verifies connection exists.
3. Requester completes OTP.
4. System rejects duplicate pending delink.
5. System creates delink ticket.
6. Applicable affected-party/family confirmation is requested.
7. Admin decides.
8. On approval, remove only selected connection.
9. Retain person record, Member Reference, audit history and other family links.

---

### 8. Family Confirmation Functional Rules

* Select at most one recipient from each qualifying level: top-level, immediate-level, same-level.
* Deduplicate recipients across levels.
* Recipient action: Confirm or Reject.
* Record recipient, level, response, timestamp and request.
* Do not treat confirmation as final approval.
* Admin can approve or reject regardless of family confirmation result, subject to policy.

---

### 9. Request / Ticket State Machine

| State | Entry condition | Next possible states |
| :--- | :--- | :--- |
| Submitted | Request successfully created. | Verification Pending, Under Admin Review, Needs Details |
| Verification Pending | Required OTP/verification outstanding. | Under Admin Review, Rejected |
| Needs Details | Admin/system requires additional data. | Submitted, Rejected |
| Under Admin Review | Verification complete and request ready. | Duplicate Review, Approved, Rejected, Needs Details |
| Duplicate Review | Duplicate flag requires decision. | Approved, Rejected, Needs Details |
| Approved | Admin approved and official change completed. | Terminal |
| Rejected | Admin rejected. | Terminal |
| Merged | Applicable merge completed. | Terminal / history state |
| Delinked | Approved connection removed. | Terminal / history state |

Every request receives a unique ticket. Batch operations may use a parent ticket with child request IDs; child decisions are independently auditable.

---

### 10. Admin Functional Specification

* Authenticate Admin using protected credentials and JWT session.
* Apply lockout after 5 repeated failures and verify authorization on every protected action.
* Pending queue displays request type, ticket, requester context, submitted time, verification state and risk/duplicate flags.
* Duplicate review displays matching record(s) and the user's A4 proceed decision.
* Link/delink review displays selected person, target family, relationship, validation results and family-confirmation evidence.
* Approval assigns references where applicable and sets official status.
* Rejection requires Admin remarks.
* Audit viewer displays material old value/new value, actor, time, request/ticket and decision.
* Member directory supports search.
* Backup/export is available to Admin.

---

### 11. Logical Data Model

| Entity | Key functional attributes |
| :--- | :--- |
| Person | Person ID, Member Reference, name, DOB, gender, status, contact, marital details, audit timestamps. |
| Family | Family ID, Family Reference, founding couple, family number, approval status, timestamps. |
| Relationship | Relationship ID, Person A, Person B, relationship type, reciprocal/derived metadata, status. |
| Family Connection | Connection ID, Person ID, Family ID, connection type/context, status. |
| Request/Ticket | Ticket ID, parent ticket, request type, requester, payload reference, status, timestamps. |
| OTP Transaction | Transaction ID, request ID, email, purpose, expiry, attempt/rate-limit state, verification timestamp. |
| Family Confirmation | Confirmation ID, ticket, recipient, qualifying level, response, timestamp. |
| Audit | Audit ID, ticket/entity, old value, new value, actor, action, timestamp. |
| Master Data | Relationship, gender, marital status, occupation and other controlled values. |

---

### 12. Logical API Specification

| API / Service | Purpose | Core input | Core output |
| :--- | :--- | :--- | :--- |
| Search Surname | Return approved family cards. | surname | family cards |
| Get Family Members | Return approved members for a family context. | family identifier | approved member list |
| Validate Member | Run duplicate and eligibility validation. | name, DOB, email, phone, family context | errors/warnings |
| Send OTP | Create and send email OTP. | email, request context, purpose | OTP transaction |
| Verify OTP | Verify OTP code. | transaction, code | verified token |
| Create Member Request | Submit new person request. | person, relationship, requester | ticket |
| Create Link Request | Request existing-person/family link. | family/person/relationship/requester | ticket |
| Create Delink Request | Request connection removal. | connection/requester | ticket |
| Ticket Status | Track safe request status. | ticket | status |
| Admin Decision | Approve/reject/request details. | ticket, decision, remarks | updated status |
| Generate Member Reference | Generate permanent member reference. | approved person | Member Reference (`SS-FFF-MMYYYY-NNN`) |
| Generate Family Reference | Generate official family reference. | approved family | Family Reference |

---

### 13. Google Sheets Functional Storage Mapping

The baseline uses Google Sheets. The storage design supports:
* `FT_Surname_Details` (Surnames master)
* `FT_User_Details` (Persons master)
* `FT_Relationships` (Relationships)
* `FamilyLinks` (Family connections)
* `FT_Requests` (Requests and tickets)
* `Otp` (OTP transactions and hashes)
* `FamilyConfirmations` (Supporting confirmations)
* `FT_Admin` (Append-only audit log)
* `FT_Admin_Meta` (Distributed locks and metadata)

All writes protect against formula injection by stripping leading `= + - @ \t \r`. Concurrent reference generation uses transactional locking in Meta.

---

### 14. Public API & Privacy Contract

* Public APIs use an explicit allow-list of safe fields.
* Public family cards and tree views expose names and relationship structure only.
* Do not expose DOB, phone, email, Member Reference, Family Reference, occupation, location, photo or other private fields.
* Tree node identifiers used publicly are throwaway display IDs (`node_<hex>`) and must not be Member References.
* Ticket lookup must not reveal private request data solely from the ticket number.

---

### 15. Security & NFR Functional Controls

* Server-side validation is authoritative.
* OTP expiry, attempt limits and rate limits are enforced server-side.
* CAPTCHA and search/form rate limits are server-side.
* Secrets remain in environment configuration and never in source code or browser bundles.
* Protected Admin APIs require authorization on every action.
* Admin session timeout and 5-attempt lockout are enforced.
* Audit trail is strictly append-only.
* Errors return friendly user-facing messages; never expose stack traces or raw Google Sheet errors.
* Mobile-first responsive UI.
* Tree remains usable at 100+ members.
* Health endpoint `/api/health` is available after deployment.
* Backup and restore are tested before launch.

---

### 16. Error Handling

| Scenario | Expected behavior |
| :--- | :--- |
| Surname not found | Show no approved family and offer founding-family path. |
| Duplicate adult email | Hard block; do not proceed to OTP for the blocked request. |
| Duplicate phone | Hard block according to finalized duplicate-phone rule. |
| A4 exact identity match | Warning with Go Back and Proceed Anyway buttons. |
| Invalid OTP | Show friendly invalid/expired message; enforce attempt limit. |
| Relationship conflict | Block submission and explain the business validation issue. |
| Self-link / ancestor loop | Block request. |
| Duplicate pending request | Prevent duplicate submission or route to existing ticket. |
| Reference generation failure | Do not create a partial official family/person record; surface retry/admin error path. |
| Sheet/infrastructure failure | Show friendly message; log technical details securely; do not expose raw error. |

---

### 17. Audit Events

* Request creation.
* OTP generated and verification result without storing raw OTP.
* Duplicate check result.
* A4 warning shown and Proceed Anyway selected.
* Family confirmation sent and responded.
* Admin approval/rejection and remarks.
* Family Reference assignment.
* Member Reference assignment.
* Relationship creation/update/removal.
* Link and delink operations.
* Merge where applicable.
* Material field edit with old/new value.

---

### 18. Acceptance Test Scenarios

| ID | Scenario | Expected result |
| :--- | :--- | :--- |
| FT-001 | Search surname with approved families | Distinct approved families render as separate cards. |
| FT-002 | Search surname with pending-only request | Pending request does not appear as a family. |
| FT-003 | Add member using non-founder | Any approved family member can be selected as Related To. |
| FT-004 | Add member relationship semantics | System records: New person -> Relationship -> Selected person. |
| FT-005 | Different-surname link first screen | Sequence is: Family -> Person -> Relationship. |
| FT-006 | A4 duplicate warning | Exact name+DOB match shows warning with Go Back and Proceed Anyway. |
| FT-007 | A4 proceed | Proceed choice is stored for Admin review. |
| FT-008 | Duplicate adult email | Creation is hard blocked and no duplicate person is created. |
| FT-009 | Minor onboarding | Parent/guardian verification is used; minor personal contact is not required. |
| FT-010 | Deceased onboarding | Date of Death required; personal email/phone not required. |
| FT-011 | Existing person link | No new person record; existing Member Reference retained. |
| FT-012 | Member Reference | Approved person receives `SS-FFF-MMYYYY-NNN`. |
| FT-013 | Family Reference | Approved family receives Family Reference only after approval. |
| FT-014 | Family confirmation | Up to three eligible recipients; duplicate recipient requests prevented. |
| FT-015 | Admin approval | Only Admin approval makes change official. |
| FT-016 | Delink | Only selected connection is removed; person and other family connections remain. |
| FT-017 | Audit | Material request and Admin decision are recorded. |
| FT-018 | Public privacy | Public API does not return private attributes or reference IDs. |

---

### 19. Implementation Dependencies & Open Decisions

| Dependency / decision | Status / action |
| :--- | :--- |
| Relationship Master Data | Owner to provide final dropdown values. |
| Gender Master Data | Finalize allowed values. |
| Marital Status Master Data | Finalize values. |
| Occupation Master Data | Admin-managed list. |
| Location structure | Finalize hierarchy/format. |
| Member sequence scope | Decide global vs scoped sequence. |
| Founding special cases | Finalize deceased founder/missing spouse UX and validation. |
| API contracts | Engineering to finalize endpoint paths, schemas and auth. |
| Google Sheets schema | Engineering to finalize tabs/columns and locking strategy. |
| Photo | Phase 2 unless scope changes. |

---

### 20. Traceability to PRD

| PRD requirement | FSD coverage |
| :--- | :--- |
| Family identity | Sections 2, 4, 11, 14 |
| Family cards | Section 4.2 |
| Add Members | Sections 4.3, 5, 7.2 |
| Same-surname link | Sections 4.4, 7.3 |
| Different-surname link | Sections 4.5, 7.3 |
| A1 Family Reference | Sections 11, 12, 18 |
| A2 Member Reference | Sections 11, 12, 18 |
| A3 Link/Delink | Sections 7.3, 7.4, 8, 10 |
| A4 Duplicate warning | Sections 6.4, 16, 18 |
| Tickets | Section 9 |
| Admin approval | Section 10 |
| Privacy/security | Sections 14, 15 |

---

### 21. End-to-End Functional Sequence

Search -> Select Family -> Select action -> Select Related To / Family / Person / Relationship as applicable -> Enter Member Details where required -> Validate -> OTP verification -> Duplicate check / recheck -> Submit -> Ticket -> Family confirmation where applicable -> Admin Review -> Approve / Reject -> Generate permanent reference(s) if applicable -> Create official relationship / connection -> Audit -> Confirmation.
