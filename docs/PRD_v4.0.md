# FAMILY TREE PORTAL
## PRODUCT REQUIREMENTS DOCUMENT (PRD)
### Version 4.0 | 11 November 2026 | Working Baseline

---

### 1. Document Control

| Item | Value |
| :--- | :--- |
| Document | Family Tree Portal - Product Requirements Document |
| Version | 4.0 |
| Date | 11 November 2026 |
| Status | Working Baseline |
| Source baseline | Family_Tree_Portal.docx V2.1 and Family_Tree_Portal_Use_Cases.docx |
| Current decision baseline | Explicit product decisions finalized during requirements deep-dive through 11 Nov 2026 |
| Product owner / decision authority | Single Master Admin for the portal |
| Technology baseline | Vercel hosting; Google Sheets data store |
| Public access | No user login; surname search and approved-family viewing are public |

This PRD defines what the Family Tree Portal must achieve from a product and business perspective. It intentionally separates product intent, scope, rules, journeys and acceptance expectations from implementation-level API, sheet-column and UI specifications. Items not finalized by the owner remain explicitly marked TBD.

---

### 2. Product Vision

Create a controlled family-lineage portal where families can discover approved family trees, register new people, connect existing people and families, and maintain lineage over time. Every official change is verified, auditable and approved by the single Master Admin.

---

### 3. Problem Statement

* Families need a reliable way to represent lineage across generations and across surname changes.
* Same surname does not necessarily mean the same family, so surname alone cannot define family identity.
* The same person may legitimately belong to more than one family tree, especially through marriage or cross-family lineage, and must not be recreated as a duplicate person.
* Public users need a simple discovery experience while personal information must remain protected.
* Family changes require evidence, verification and an authoritative approval process.

---

### 4. Product Goals

1. Provide surname-based discovery of approved families.
2. Maintain a persistent person record and permanent Member Reference for each official person.
3. Represent families by founding couple and approved connected members, not by surname alone.
4. Allow controlled add-member, link, delink and family-connection requests.
5. Use email OTP to verify applicable requesters and responsible contacts.
6. Provide duplicate warnings and hard-block rules appropriate to the type of identity data.
7. Give the Master Admin final authority over official lineage changes.
8. Provide ticket tracking and an append-only audit trail for material changes.

---

### 5. Product Principles

* **Approval-first**: Nothing becomes official before Master Admin approval.
* **Identity-first**: One person record can participate in multiple family trees.
* **Evidence-based**: Family confirmation supports an Admin decision but never replaces it.
* **Privacy-by-default**: Public views expose names and tree relationships only.
* **Permanent references**: Member Reference and Family Reference are never reused.
* **Server-authoritative validation**: Client validation improves usability; server validation decides.
* **Explicit ambiguity**: Unresolved master data or exceptional flows remain TBD rather than being silently invented.

---

### 6. Actors

| Actor | Primary capability |
| :--- | :--- |
| Visitor / Requester | Search surnames, view approved family cards, start applicable requests and submit information. |
| Registered Member | Adult member with verified registered email; may initiate protected add/link/delink flows subject to authorization. |
| Master Admin | Single authority for review, duplicate/conflict resolution, approval, rejection and official record changes. |
| System | Performs OTP, validation, duplicate checks, ticketing, relationship validation, reference generation, audit and notifications. |

---

### 7. Scope

#### 7.1 In Scope
* Surname search and approved family discovery.
* Family cards with family-level actions.
* Founding-family registration.
* Add Members to an existing family.
* Link Same-Surname Family.
* Link Different-Surname Family.
* Link and delink existing approved person/family connections.
* Reusable Member Details / onboarding form.
* Email OTP verification and requester verification.
* Duplicate validation and Admin duplicate review.
* Family confirmation for applicable links.
* Master Admin queues, approval/rejection and audit.
* Ticket creation and safe ticket-status tracking.
* Names-only public tree/family views.
* Google Sheets-backed data model and Vercel deployment baseline.

#### 7.2 Out of Scope / Later Phase
* Relationship calculator as a standalone feature.
* Birthdays, anniversaries and event calendar.
* Extended cultural fields such as Gotra, Kuladevata and memorial notes.
* Photo as a Phase-1 requirement; source baseline places photo in Phase 2.
* Any additional viewer tier beyond the names-only public view.

---

### 8. Family & Person Concepts

* A family is defined by its founding husband and wife and includes every approved member connected to that family through the family tree. A member with a different surname can belong to the family. If another founding family has no approved connection to an existing tree, it remains a separate Family 1 / Family 2 identity.
* Surname is only the discovery/search key. It is not the technical identity of a family.
* A person is persistent and may appear in multiple family trees without creating another person record. The same person keeps the same Member Reference across those family associations.

---

### 9. Reference ID Requirements

#### 9.1 Family Reference
* Created only after Master Admin approval.
* Pending/rejected requests receive no official Family Reference.
* Same-surname families are numbered by approval order: Family 1, Family 2, etc.
* No partial official family record is created if reference generation fails.
* Family Reference is internal to the Admin/System and is not public.

#### 9.2 Member Reference
* Format: `SS-FFF-MMYYYY-NNN`
  * `SS`: First 2 letters of surname (e.g. `MU`)
  * `FFF`: First 3 letters of first name (e.g. `NAR`)
  * `MMYYYY`: DOB month + year (e.g. `071995`)
  * `NNN`: System-generated sequence (e.g. `001`)
  * Example: `MU-NAR-071995-001`
* Uppercase and backend generated.
* Permanent and never reused.
* Does not change after name/surname/DOB correction, linking or merging.
* Same person keeps the same reference across families.
* Generated when the person becomes an approved official member.
* Sequence scope (global vs other scope) is TBD.

---

### 10. Core User Journeys

#### 10.1 New Founding Family
1. Search surname.
2. If no approved family exists, start founding-family registration.
3. Enter founding husband and wife details.
4. Verify living adult founding members by applicable email OTP.
5. Run validation and duplicate checks.
6. Submit and receive ticket.
7. Admin reviews concurrent requests for the surname and determines family identity.
8. On approval, create Family Reference and Member References.
9. Send confirmation.

#### 10.2 Add Members
1. Open Add Members from the selected family card.
2. Select any approved existing family member as Related To.
3. Select Relationship from Relationship Master Data.
4. Interpret the selection as: New person -> Relationship -> Selected person.
5. Open the separate Member Details form.
6. Enter the new person's information and applicable responsible-contact data.
7. Run verification and duplicate checks.
8. Submit, create ticket and route to Admin.
9. On approval, create the official person/member reference and relationship.

#### 10.3 Link Same-Surname Family
1. Open Link Same-Surname Family from the family card.
2. Select an approved person from the relevant same-surname family context.
3. Select Relationship.
4. Interpret as: New/Linking person -> Relationship -> Selected person.
5. Continue through verification, ticketing, family confirmation where applicable and Admin approval.
6. No new person record is created merely by selecting an existing person.

#### 10.4 Link Different-Surname Family
1. Open Link Different-Surname Family.
2. Select the target Family.
3. Select an approved Person in that family.
4. Select Relationship.
5. Interpret as: New/Linking person -> Relationship -> Selected person.
6. Continue through verification, ticketing, confirmation where applicable and Admin approval.
7. Note: The approved first-screen sequence is Family -> Person -> Relationship. The prior surname-selection step is superseded.

#### 10.5 Link Existing Person
1. Select existing approved person in the target family.
2. Select relationship.
3. Verify requester through applicable registered-email OTP.
4. Validate relationship and duplicate pending connection.
5. Create ticket.
6. Collect up to three family confirmations where applicable.
7. Admin makes final decision.
8. On approval, create the family connection without creating a duplicate person.

#### 10.6 Delink
1. Select an existing connection.
2. Verify requester by OTP.
3. Validate that the connection exists and no duplicate delink is pending.
4. Create delink ticket and collect applicable confirmation.
5. Admin decides.
6. On approval, remove only the selected family connection; retain person, Member Reference and other family connections.

---

### 11. Duplicate & Identity Rules

* **A4 Warning**: Exact First Name + Middle Name + Last Name + DOB match within the selected family triggers an A4 warning, not an automatic hard block.
  * Warning text: "A person with the same details already exists in this family."
  * User may choose "Go Back" or "Proceed Anyway".
  * System records that the warning was shown and that the requester proceeded.
  * Admin sees the duplicate match during review and makes the final decision.
* **Exact Adult Email Duplicate**: Hard block. Do not issue OTP for the blocked creation request.
* **Duplicate Phone**: Hard block according to the owner-finalized rule.
* Critical duplicate checks are repeated server-side before approval.
* Existing Member Reference is never changed by duplicate review.

---

### 12. Verification & Privacy

* Fresh OTP is required for protected requests according to the applicable workflow.
* Requester OTP and new-adult OTP are separate concepts.
* OTP proves control of the email; it does not itself prove the relationship or grant official status.
* Minors use parent/guardian email verification where applicable.
* Deceased persons do not require personal email/phone.
* Public screens and APIs expose names and relationship structure only; private attributes and reference IDs remain non-public.

---

### 13. Relationship Rules

* Existing selected person must be approved.
* No self-link.
* No ancestor loops.
* At most one father and one mother.
* Spouse relationship is reciprocal.
* Parent must be at least 12 years older than child when DOB is known.
* Applicable gender constraints are enforced from final master data.
* Existing or pending duplicate relationships are prevented.
* Reverse relationship is created automatically where applicable.
* Brother, uncle, cousin and similar derived relationships are calculated rather than stored.

---

### 14. Member Details Form Specifications

| Section | Fields | Requirement |
| :--- | :--- | :--- |
| Person | Surname, First, Middle, Last, Gender, DOB, Status | Core identity data. |
| Marital | Marital Status, Surname Before Marriage, Surname After Marriage, Marriage Date | Conditional; surname change does not create a new person. |
| Contact | Email, OTP, Phone | Conditional by age/status. |
| Relationship | Related To, Relationship | Used for new-member and link flows; selection is a separate step. |
| Responsible Contact | Parent/Guardian details | Required for applicable minors/responsible-contact cases. |
| Additional | Occupation, Location, Photo | Occupation/location are applicable; photo is Phase 2 in source baseline. |
| Requester | Name, Phone, Relationship, Email/OTP | Required for protected request submission. |
| Review | Warnings, consent, submit | Final request review. |

Founding-member initial registration uses core capture: First Name, Middle Name, Last Name, DOB, Phone and Email, with multiple founding members supported via Add Founding Member. Detailed profile information is a separate reusable onboarding flow.

---

### 15. Tickets, Status & Audit

* Every request receives a unique ticket.
* Batch requests may have parent/child ticket relationships.
* Ticket status can be tracked without exposing private data.
* Material changes and decisions are recorded in an append-only audit trail.
* Approval is the point at which a requested change becomes official.

| Status | Meaning |
| :--- | :--- |
| Submitted | Request received. |
| Verification Pending | Required verification is outstanding. |
| Needs Details | Additional information is required. |
| Under Admin Review | Admin is reviewing. |
| Duplicate Review | Duplicate indicator requires decision. |
| Approved | Official change completed. |
| Rejected | Request not approved. |
| Merged | Applicable record/family merge completed. |
| Delinked | Approved connection removed. |

---

### 16. Family Confirmation

* For applicable links, up to three eligible family members may be selected: one top-level, one immediate-level and one same-level member.
* A member who qualifies at multiple levels receives only one confirmation request.
* Any eligible recipient may Confirm or Reject.
* Family confirmation is supporting evidence only; Master Admin remains the final authority.
* Admin review includes relationship context, verification, duplicate warnings and confirmation results.

---

### 17. Admin Product Requirements

* Single Admin login with protected sessions and lockout controls.
* Pending-request queue.
* Duplicate-review queue.
* Link/delink queue.
* Member directory/search.
* Side-by-side family context for family-link decisions where applicable.
* Approval/rejection with remarks for rejection.
* Audit log viewer.
* Backup/export capability.
* Dashboard metrics: pending duplicates, verified-member percentage, duplicate-check response time, family count and member count.

---

### 18. Non-Functional Expectations

* Mobile-first responsive experience.
* Tree remains usable for 100+ members.
* Friendly errors; no raw stack traces or infrastructure errors.
* Server-side rate limits, CAPTCHA and OTP limits.
* Secrets never exposed in browser code.
* Public API uses an explicit safe-field allow-list.
* Concurrent approvals must not generate duplicate references.
* DPDP 2023 obligations such as consent, correction/deletion and parent consent for minors require legal confirmation before final legal implementation.

---

### 19. Acceptance Criteria

1. Approved surname search returns separate cards for distinct families.
2. Same-surname but unconnected families remain separate.
3. Add Members allows Related To to be any approved family person.
4. Current card-action flows are preserved, including Different-Surname Family: Family -> Person -> Relationship.
5. Relationship semantics always read as: New/Linking person -> Relationship -> Selected person.
6. Exact Name + DOB match warning offers Go Back and Proceed Anyway.
7. Exact duplicate adult email is blocked.
8. Living adult's applicable email is OTP verified before approval.
9. Minor uses responsible parent/guardian verification.
10. Deceased member captures Date of Death and does not require personal email/phone.
11. Existing-person linking does not create a duplicate person record.
12. Member Reference is generated on approval in `SS-FFF-MMYYYY-NNN` format.
13. Family confirmation never replaces Master Admin approval.
14. Every request receives a ticket and auditable status.

---

### 20. Open / Pending Decisions

| Decision | Status |
| :--- | :--- |
| Relationship Master Data | Owner to provide final values. |
| Gender Master Data | Exact allowed values TBD. |
| Marital Status Master Data | Exact values TBD. |
| Occupation Master Data | Admin-managed list to be supplied/confirmed. |
| Location structure | Detailed hierarchy TBD. |
| Member sequence scope | Global vs other scope TBD. |
| Founding special-case UX | Final flow for deceased founder/missing spouse TBD. |
| API endpoint names | Engineering design pending. |
| Google Sheets columns/tabs | FSD implementation mapping pending. |
| Photo | Phase 2 unless owner changes scope. |
