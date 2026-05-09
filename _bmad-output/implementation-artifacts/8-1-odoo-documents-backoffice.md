# Story 8.1: Odoo Documents Backoffice

Status: review

## Story

As an **Admin/SuperAdmin**,
I want to browse Odoo Documents and see which documents are related to trips/products,
So that I can manage non-public operational documentation such as contracts, quotes, coupons, payments, and sales files without exposing it publicly.

## Acceptance Criteria

### AC1: Admin/SuperAdmin Documents Module
**Given** an Admin or SuperAdmin is logged in
**When** they navigate to `/admin/documents` or `/superadmin/documents`
**Then** they can see Odoo documents captured in the Odoo Documents module (`documents.document`)
**And** the page uses the existing AdminShell/RoleSidebar layout
**And** Director, Agent, and Client roles cannot access this module
**And** access is controlled through a new permission `documents:read`

### AC2: Separate Public Product Documents from Backoffice Documents
**Given** Odoo has product-level documents in `product.document`
**When** the module displays a trip/product detail
**Then** documents linked directly by `product.document.res_model = product.template` and `res_id = odooProductId` are shown as **public product documents**
**And** these are clearly labeled as public/catalog documents
**And** they continue to be the source for public trip pages and product pages
**And** no `documents.document` backoffice file is treated as public by default

### AC3: Backoffice Documents from `documents.document`
**Given** Odoo has folders and files in `documents.document`
**When** the sync/explorer reads the module
**Then** it reads folders (`type = folder`) and files (`type != folder`)
**And** it uses `folder_id` to build the folder tree
**And** it stores safe metadata only: Odoo document id, name, type, mimetype, file size, folder id/name/path, attachment id, owner/create/write metadata, inferred relation, and last sync timestamp
**And** it never stores binary file content in Firestore
**And** access to Odoo download URLs goes through an authenticated server route, not a public direct URL

### AC4: Folder-to-Product Matching
**Given** a `documents.document` folder name can be normalized and matched to a `product.template.name`
**When** the match is exact or high confidence
**Then** the module relates the folder and its child documents to that product/trip
**And** the relationship stores match metadata: `matchType`, `confidence`, `matchedBy`, `folderName`, `odooProductId`, `tripId`
**And** exact normalized name matches can be auto-linked
**And** fuzzy matches must be marked as suggested until Admin/SuperAdmin confirms them
**And** confirmed mappings are persisted so future syncs do not rely only on fuzzy matching

### AC5: Unrelated / Unmatched Documents
**Given** a folder or document cannot be related to a product/trip
**When** the documents module displays results
**Then** it shows an explicit **Sin relacionar** view
**And** every unmatched item includes a reason such as: no product name match, ambiguous match, operational folder, missing parent folder, or unsupported document type
**And** Admin/SuperAdmin can manually relate a folder to a product/trip or mark it as intentionally unrelated
**And** unrelated documents remain visible to Admin/SuperAdmin, not hidden

### AC6: Operational Document Classification
**Given** the Odoo Documents module includes folders such as Ventas, Pagos, Cotizaciones, Cupones, Contratos, Projects, and itineraries/flyers
**When** the sync/import classifies documents
**Then** it labels documents with an inferred scope: `public-product`, `trip-backoffice`, `quote`, `payment`, `contract`, `coupon`, `sales`, `internal`, or `unmatched`
**And** classification is based on folder path, file name, mimetype, and confirmed folder mappings
**And** classification can be overridden manually by Admin/SuperAdmin
**And** the UI makes it obvious which documents are operational/internal and not public

### AC7: Search, Filters, and Detail View
**Given** Admin/SuperAdmin views the Documents module
**When** they search or filter
**Then** they can filter by relation status, product/trip, folder, document scope, mimetype, and last updated date
**And** they can search by document name, folder name, product name, or Odoo id
**And** each row/card shows: document name, folder path, inferred relation, scope, mimetype, size, last updated, and source model
**And** a detail view shows public product documents and related backoffice documents together for the selected trip/product

### AC8: Odoo Product Write Probe, Guarded
**Given** Admin/SuperAdmin needs to verify Odoo write capability
**When** an explicit manual probe is run
**Then** it creates a single test `product.template` with a clearly prefixed name such as `[PWA TEST DO NOT USE] Documents Write Probe YYYY-MM-DD HHmm`
**And** the product is inactive (`active=false`), not saleable (`sale_ok=false` if accepted by Odoo), not website-published, and priced at 0 or 1 MXN
**And** the probe records the created Odoo product id, timestamp, created values, and cleanup instructions
**And** the probe is never run automatically from normal sync or page load
**And** running the probe requires explicit operator confirmation in the implementation session

### AC9: Tests and Verification
- Unit tests cover folder matching, normalization, ambiguous matches, classification, and manual mapping persistence.
- API tests cover Admin/SuperAdmin access, denied roles, Odoo failure, unmatched documents, and no binary leakage.
- UI tests cover filters, unmatched view, related detail view, and role-restricted navigation.
- `pnpm typecheck` passes with 0 errors.
- Targeted `pnpm test` passes for new/changed files.

## Tasks / Subtasks

- [ ] Task 1: Odoo exploration hardening (AC3, AC4, AC5, AC6)
  - [ ] Create a non-committed/manual-safe exploration command or script for `documents.document` metadata.
  - [ ] Query `fields_get` for `documents.document`, `product.document`, and `ir.attachment`.
  - [ ] Confirm fields used by this story: `id`, `name`, `type`, `mimetype`, `file_size`, `folder_id`, `attachment_id`, `res_model`, `res_id`, `res_name`, `owner_id`, `create_uid`, `create_date`, `write_uid`, `write_date`.
  - [ ] Document Odoo 18 limitation: `documents.document` currently does not reliably link to `product.template`; relation is primarily folder/name based.
  - [ ] Never print API keys or access tokens in logs.

- [ ] Task 2: Types and schemas (AC2, AC3, AC4, AC5, AC6)
  - [ ] Add document metadata types for public product documents and backoffice Odoo documents.
  - [ ] Add Zod schemas for Odoo document metadata and folder mapping operations.
  - [ ] Add enum for document scope: `public-product`, `trip-backoffice`, `quote`, `payment`, `contract`, `coupon`, `sales`, `internal`, `unmatched`.
  - [ ] Add tests for schema validation and unsafe fields exclusion.

- [ ] Task 3: Odoo document model layer (AC2, AC3, AC4, AC5)
  - [ ] Add `src/lib/odoo/models/documents.ts`.
  - [ ] Implement `fetchProductDocumentsFromOdoo(odooProductIds)` using `product.document`.
  - [ ] Implement `fetchDocumentsModuleTreeFromOdoo()` using `documents.document`.
  - [ ] Implement pagination with batch size 100 and no binary fields.
  - [ ] Implement safe metadata mapping with Zod `safeParse`.

- [ ] Task 4: Matching and classification engine (AC4, AC5, AC6)
  - [ ] Normalize names using lowercase, diacritic removal, punctuation collapse, and trimmed whitespace.
  - [ ] Exact match: normalized folder name equals normalized product name.
  - [ ] Suggested match: strong token overlap with one clear candidate.
  - [ ] Ambiguous match: multiple candidates above threshold.
  - [ ] Unmatched reason codes: `no-product-match`, `ambiguous-match`, `operational-folder`, `missing-parent`, `unsupported-type`.
  - [ ] Add classification rules for `PAGOS`, `VENTAS`, `COTIZACIONES`, `CUPONES`, `CONTRATOS`, `Projects`, `ITINERARIOS`, and `flyers`.

- [ ] Task 5: Firestore persistence (AC3, AC4, AC5, AC6)
  - [ ] Create `/odooDocuments/{documentId}` for metadata snapshots.
  - [ ] Create `/odooDocumentFolders/{folderId}` for folder metadata.
  - [ ] Create `/odooDocumentFolderMappings/{folderId}` for confirmed or ignored folder-to-product mappings.
  - [ ] Store only metadata and relation state; never binary file content.
  - [ ] Preserve manual mappings across syncs.

- [ ] Task 6: API routes (AC1, AC3, AC4, AC5, AC7)
  - [ ] Add `GET /api/odoo/documents` for listing/search/filtering synced metadata.
  - [ ] Add `POST /api/odoo/documents/sync` for Admin/SuperAdmin manual sync.
  - [ ] Add `POST /api/odoo/documents/folder-mappings` for confirming/ignoring mappings.
  - [ ] Add authenticated download/proxy route only if required; do not expose raw public URLs for backoffice documents.
  - [ ] Use `requirePermission('documents:read')` for reads and `requirePermission('documents:manage')` for sync/mapping updates.

- [ ] Task 7: UI module (AC1, AC5, AC6, AC7)
  - [ ] Add sidebar item `Documentos` for Admin and SuperAdmin only.
  - [ ] Add `/admin/documents/page.tsx` and `/superadmin/documents/page.tsx`.
  - [ ] Build shared `DocumentsPanel` client component.
  - [ ] Include tabs or segmented control: `Relacionados`, `Sin relacionar`, `Carpetas`, `Publicos del producto`.
  - [ ] Include filters for relation status, scope, mimetype, folder, trip/product, date.
  - [ ] Include detail drawer/page for a selected product/trip.

- [ ] Task 8: Guarded Odoo write probe (AC8)
  - [ ] Create a manual script or guarded admin action to create one inactive test `product.template`.
  - [ ] Values must include prefix `[PWA TEST DO NOT USE]`, `active=false`, `sale_ok=false` where accepted, `website_published=false` where accepted, and minimal price.
  - [ ] The script/action must print the created Odoo id and exact cleanup command/instructions.
  - [ ] Do not run this probe during implementation without explicit operator approval.

- [ ] Task 9: Tests and verification (AC9)
  - [ ] Unit tests for matching/classification.
  - [ ] API route tests for auth, filters, sync failure, no binary leakage.
  - [ ] UI tests for Admin/SuperAdmin access and unmatched documents view.
  - [ ] Run targeted tests, `pnpm typecheck`, and lint if touched files require it.

## Dev Notes

### Current Odoo Findings (2026-05-08)

Exploration against AroundaPlanet Odoo production found:

- `product.document`: 1381 records.
- `documents.document`: 1429 records total.
- `documents.document` folders: 177.
- `documents.document` non-folder files: 1252.
- `documents.document` has 124 fields.

Top-level or important folders observed:

- `Projects`
- `ITINERARIOS y flyers`
- `CUPONES 2025`
- `CUPONES 2026`
- `CONTRATOS Y CARTAS GRALES`
- `CONTRATOS TOURS NACIONALES`
- `CONTRATOS TOUR INTERNACIONAL`
- `PAGOS VIAJES 2026/2027`
- `COTIZACIONES 2026`
- `VENTAS ABRIL 2026`
- `VENTAS MAYO 2026`

Important exact folder/product matches observed:

- Folder `ASIA MAYO 2026` -> product `ASIA MAYO 2026`.
- Folder `ASIA MAYO1 2026` -> product `ASIA MAYO1 2026`.
- Folder `COLOMBIA MAYO 2026 VUELO DESDE GDL` -> product with same name.
- Folder `COLOMBIA MAYO 2026 ORIGINAL` -> product with same name.
- Folder `COLOMBIA MAYO 2026 TOURS` -> product with same name.
- Folder `PERU ABRIL 2026` -> product `PERU ABRIL 2026`.
- Folder `ASIA 2026` -> product `ASIA 2026`.

Operational folders contain sensitive or internal data. Examples include PDFs named after customers under `VENTAS ABRIL 2026`, spreadsheets under `PAGOS VIAJES 2026/2027`, and quotation spreadsheets under `COTIZACIONES 2026`. These must be Admin/SuperAdmin only.

### Source Model Semantics

Use two separate concepts:

1. `product.document`: public or product-attached documents.
   - Direct relation to product: `res_model = product.template`, `res_id = odooProductId`.
   - Includes fields such as `shown_on_product_page`, `attached_on_sale`, `ir_attachment_id`.
   - These are the safe source for public trip/product pages after normal publication checks.

2. `documents.document`: backoffice Documents module.
   - Folder/file tree using `folder_id`.
   - No reliable direct product relation observed.
   - Must be matched by folder name or persisted manual mapping.
   - Must be treated as private/internal unless explicitly classified otherwise.

### Existing Code to Reuse

- `src/lib/odoo/client.ts`: Odoo XML-RPC client with auth, retry, rate limit, `searchRead`, `search`, `read`, `create`, `write`.
- `src/config/odoo.ts`: add TTL entries for `documents.document` if needed.
- `src/lib/odoo/models/trips.ts`: already has `fetchOdooDocuments()` for `product.document`.
- `src/types/trip.ts`: currently has `OdooDocument` and `Trip.odooDocuments`.
- `src/components/custom/RoleSidebar.tsx`: add `Documentos` item for Admin/SuperAdmin.
- `src/components/shared/AdminShell.tsx`: reuse existing shell.
- `src/lib/auth/seedPermissions.ts`: add `documents:read` and `documents:manage`.
- API routes should follow existing App Router route handler patterns and `handleApiError()`.

### Security Requirements

- Admin and SuperAdmin can view and manage backoffice document metadata.
- Director, Agent, and Client must not access these documents.
- Do not expose raw `access_token`, binary fields, `datas`, `raw`, `db_datas`, `checksum`, or any Odoo API key.
- Backoffice document downloads, if implemented, must go through an authenticated server route.
- Firestore stores metadata only.
- Treat names in `VENTAS`, `PAGOS`, `CONTRATOS`, `CUPONES`, and `COTIZACIONES` as potentially sensitive.

### Odoo Write Probe Guardrails

The write probe is valuable because it verifies `create()` permissions for `product.template`, but it modifies production Odoo. It must be:

- Manual.
- Explicitly confirmed by the operator.
- Single-record only.
- Clearly named with `[PWA TEST DO NOT USE]`.
- Inactive and not saleable.
- Logged with created Odoo id and cleanup instructions.

Do not add the probe to normal sync. Do not run it automatically in tests.

### Odoo Write Probe Result (2026-05-08)

Manual probe was explicitly approved by the operator and executed once.

- Model: `product.template`
- Created Odoo id: `1937`
- Name: `[PWA TEST DO NOT USE] Documents Write Probe 202605081807`
- Flags confirmed after read-back:
  - `active: false`
  - `sale_ok: false`
  - `website_published: false`
  - `is_published: false`
  - `purchase_ok: false`
  - `type: service`
  - `list_price: 1`
- `create_date`: `2026-05-08 18:07:14`
- `write_date`: `2026-05-08 18:07:14`

Cleanup guidance: record is already archived/inactive. If permanent cleanup is approved by the business, delete/unlink `product.template` id `1937`; otherwise leave it inactive as write-probe evidence.

### Odoo Champions Sandbox Data (2026-05-08)

Manual sandbox movements were explicitly requested to let champions review how cliente, agente, cotizacion, and abonos appear in Odoo/PWA integrations.

- Sandbox tag: `[PWA TEST] Champions Sandbox 202605081811`
- Product template: `1937`
- Product variant: `1844`
- Client partner: `res.partner` id `4271`
  - Name: `[PWA TEST] Champions Sandbox 202605081811 Cliente`
- Agent/team: `crm.team` id `193`
  - Name: `[PWA TEST] Champions Sandbox 202605081811 Agente`
- Quotation: `sale.order` id `13379`
  - Name: `S13379`
  - State: `draft`
  - Amount total: `50000`
  - Origin: `PWA-SANDBOX-PRODUCT-1937`
  - Client reference: `PWA TEST CHAMPIONS 202605081811`
  - Salesperson: Noel Sahagun Cervantes (`res.users` id `2`)
  - Team/agent: `crm.team` id `193`
- Quotation line: `sale.order.line` id `33348`
  - Product template: `1937`
  - Product variant: `1844`
  - Quantity: `1`
  - Unit price: `50000`
- Draft abonos:
  - `account.payment` id `8026`, state `draft`, amount `15000`, journal `Bank`, memo `[PWA TEST] Abono 1 sandbox para S13379 producto 1937`
  - `account.payment` id `8027`, state `draft`, amount `10000`, journal `Bank`, memo `[PWA TEST] Abono 2 sandbox para S13379 producto 1937`

Safety note: quotation remains draft and payments remain draft. No sale was confirmed, no invoice was posted, and no payment was posted/reconciled during this setup.

### Anti-Patterns

- Do not infer public visibility from `documents.document`.
- Do not auto-link low confidence fuzzy matches.
- Do not hide unmatched documents.
- Do not store binary content in Firestore.
- Do not print access tokens or secret values.
- Do not write to Odoo during normal page load.
- Do not use `as Type` for Odoo records; use Zod `safeParse`.

### Suggested File Structure

New files:

```text
src/types/odooDocuments.ts
src/schemas/odooDocumentsSchema.ts
src/schemas/odooDocumentsSchema.test.ts
src/lib/odoo/models/documents.ts
src/lib/odoo/models/documents.test.ts
src/lib/odoo/sync/document-sync.ts
src/lib/odoo/sync/document-sync.test.ts
src/app/api/odoo/documents/route.ts
src/app/api/odoo/documents/route.test.ts
src/app/api/odoo/documents/sync/route.ts
src/app/api/odoo/documents/sync/route.test.ts
src/app/api/odoo/documents/folder-mappings/route.ts
src/app/api/odoo/documents/folder-mappings/route.test.ts
src/components/custom/DocumentsPanel.tsx
src/components/custom/DocumentsPanel.test.tsx
src/app/(admin)/admin/documents/page.tsx
src/app/(superadmin)/superadmin/documents/page.tsx
```

Existing files likely modified:

```text
src/components/custom/RoleSidebar.tsx
src/lib/auth/seedPermissions.ts
src/config/odoo.ts
```

### References

- [Source: src/lib/odoo/client.ts - OdooClient create/searchRead/read/write]
- [Source: src/lib/odoo/models/trips.ts - product.document integration]
- [Source: src/types/trip.ts - OdooDocument, Trip.odooDocuments]
- [Source: src/components/custom/RoleSidebar.tsx - Admin/SuperAdmin navigation]
- [Source: src/lib/auth/seedPermissions.ts - permission matrix]
- [Source: _bmad-output/implementation-artifacts/2-1a-trip-sync-odoo-firestore.md - Odoo sync patterns]
- [Source: _bmad-output/implementation-artifacts/2-1b-admin-trip-crud-document-uploads.md - trip document upload/public document behavior]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `pnpm typecheck` passed.
- Targeted ESLint passed for the new/modified Documents files.
- Full `pnpm lint` still fails on pre-existing unrelated files under agent clients, public trip departures, payment registration, and agent validation tests.
- Local dev server was started on `http://127.0.0.1:3000`.

### Completion Notes List

- Added first-pass Admin/SuperAdmin Documents module for review.
- Added live Odoo metadata API for `product.document` public product documents and `documents.document` backoffice folders/files.
- Added folder-to-product matching by normalized folder/product name with exact, suggested, ambiguous, and unmatched states.
- Added UI tabs for related documents, unmatched documents, folders, and public product documents.
- Added a sync endpoint placeholder that refreshes live Odoo metadata and returns sync counts; it does not persist Firestore records yet.
- Manual folder mapping, download proxy, Firestore persistence, and automated tests remain as follow-up work before calling the full story complete.

### File List

- `_bmad-output/implementation-artifacts/8-1-odoo-documents-backoffice.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/types/odooDocuments.ts`
- `src/schemas/odooDocumentsSchema.ts`
- `src/lib/odoo/models/documents.ts`
- `src/app/api/odoo/documents/route.ts`
- `src/app/api/odoo/documents/sync/route.ts`
- `src/components/custom/DocumentsPanel.tsx`
- `src/app/(admin)/admin/documents/page.tsx`
- `src/app/(superadmin)/superadmin/documents/page.tsx`
- `src/components/custom/RoleSidebar.tsx`
- `src/lib/auth/seedPermissions.ts`
- `src/config/odoo.ts`
