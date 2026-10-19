# Frontend Map

## admin-ui (Next.js 16, port 3001)

### Pages → API Calls

| Route | Component | API Calls | Auth |
|-------|-----------|-----------|------|
| `/` | Redirect | — | Checks localStorage token |
| `/auth/signin` | SignInForm | `authControllerSignIn`, `authControllerCreateSsoCode` | Public |
| `/auth/signup` | SignUpPage | `authControllerSignUp` | Public |
| `/dashboard` | DashboardPage | `organizationControllerGetMyOrganization` | Required |
| `/dashboard/applications` | ApplicationsPage | `applicationControllerListApplications`, `ehrConfigControllerGetAllPlatformScopes`, create/update app (multi-step wizard: type → fields → app-specific) | Required |
| `/dashboard/applications/[id]` | ApplicationDetailPage | `applicationControllerGetApplicationDetail`, `ehrConfigControllerGetDefinitions`, `ehrConfigControllerGetAllPlatformScopes` — tabs: EHR Integrations / Workflows / CDS Rules, pending sites approval banner | Required |
| `/dashboard/applications/[id]/ehr/[ehrName]` | EhrConfigPage | `ehrConfigControllerGetDefinition`, `ehrConfigControllerGetTokenScopes`, `ehrConfigControllerListSites`, `ehrConfigControllerCreateSite`, JWKS endpoints, `ehrConfigControllerUpsertEhrAccess` — multi-site management, per-site identifiers/credentials | Required |
| `/dashboard/users` | UsersPage | `userControllerListUsers`, `userControllerListPendingUsers`, approve/disable/role endpoints | Required |
| `/dashboard/organization` | OrganizationPage | `organizationControllerGetMyOrganization`, `organizationControllerUpdateOrganization` | Required |

### Component Hierarchy

```
app/
├── auth/
│   ├── signin/page.tsx          (SignInForm, Suspense-wrapped)
│   └── signup/page.tsx          (SignUpPage)
├── dashboard/
│   ├── layout.tsx               (DashboardLayout — nav, auth check)
│   ├── page.tsx                 (DashboardPage — overview cards)
│   ├── applications/
│   │   ├── page.tsx             (ApplicationsPage — list + creation wizard)
│   │   └── [id]/
│   │       ├── page.tsx         (ApplicationDetailPage — tabs)
│   │       ├── _components/
│   │       │   ├── EhrIntegrationsTab.tsx  (settings, EHR list, user access)
│   │       │   └── WorkflowsTab.tsx       (workflow list, execution history)
│   │       └── ehr/[ehrName]/
│   │           └── page.tsx     (EhrConfigPage — dynamic form)
│   ├── users/page.tsx           (UsersPage — manage, approve, roles)
│   └── organization/page.tsx    (OrganizationPage — org settings)
├── global-error.tsx             (Error boundary)
└── components/
    └── toast.tsx                (Toast notification — Context API)
```

### Shared Libraries

| File | Purpose |
|------|---------|
| `src/lib/admin-client.ts` | `@hs/admin-sdk` client config, auto-refresh on 401 (deduplicates concurrent attempts) |
| `src/lib/auth.ts` | `getUser()`, `setAuth()`, `getRefreshToken()`, `clearAuth()` — localStorage |
| `src/types/index.ts` | Re-exports `@hs/admin-sdk` Dto types as domain aliases |

---

## workflow-ui (Next.js 16 + @xyflow/react, port 3005)

### Pages → API Calls

| Route | Component | API Calls | Auth |
|-------|-----------|-----------|------|
| `/` | Home redirect | — | Checks localStorage token |
| `/auth/signin` | SigninPage | — (starts PKCE flow) | Public |
| `/auth/callback` | CallbackPage | `POST /oauth/token` (code + PKCE verifier) | Public |
| `/auth/sso-launch` | SsoLaunchPage | — (reads hash, starts PKCE) | Public |
| `/workflows` | WorkflowListPage | `GET /applications/{appId}/workflows` | Required |
| `/workflows/[id]` | WorkflowEditorPage | `GET /applications/{appId}/workflows/{id}`, `GET .../detail`, `GET .../llm-keys/status` | Required |
| `/workflows/new` | NewWorkflowPage | `POST /applications/{appId}/workflows` | Required |

### Component Hierarchy

```
app/
├── auth/
│   ├── signin/page.tsx          (starts OAuth PKCE flow)
│   ├── callback/page.tsx        (exchanges auth code → tokens)
│   ├── sso/page.tsx             (legacy SSO)
│   └── sso-launch/page.tsx      (SSO code → PKCE → authorize)
├── workflows/
│   ├── page.tsx                 (WorkflowListPage)
│   ├── new/page.tsx             (NewWorkflowPage)
│   └── [id]/
│       ├── page.tsx             (WorkflowEditorPage)
│       └── _components/
│           ├── WorkflowCanvas.tsx       (XYFlow canvas)
│           ├── NodePalette.tsx          (draggable node types)
│           ├── NodeConfigPanel.tsx      (property editor)
│           ├── ExecutionPanel.tsx       (run history)
│           ├── ExpressionInput.tsx      (code editor)
│           └── nodes/
│               ├── TriggerNode.tsx      (entry point)
│               ├── FhirNode.tsx         (FHIR search/read)
│               ├── ConditionNode.tsx    (if-then branch)
│               ├── TransformNode.tsx    (JSONata/Jinja)
│               ├── LlmPromptNode.tsx    (AI prompt)
│               └── OutputNode.tsx       (workflow output)
```

### Shared Libraries

| File | Purpose |
|------|---------|
| `src/lib/api.ts` | Typed API client, auto-refresh on 401, session-expired listener |
| `src/lib/auth.ts` | Token storage, JWT expiry check, `isAuthenticated()` |
| `src/lib/pkce.ts` | PKCE pair generation (SHA256 code_challenge) |

---

## cds-ui (Next.js, SMART-launched)

### Pages → API Calls

| Route | Component | API Calls | Auth |
|-------|-----------|-----------|------|
| `/app/patient/[patientId]` | ClinicalSummaryPage | getPatient, getConditions, getAllergies, getMedications, getVitals | CDS session |

### Key Components

| Component | Purpose |
|-----------|---------|
| `ClinicalSummaryPage` | Orchestrator — progressive loading of conditions, allergies, meds, vitals |
| `ConditionForm` | Create/update condition form — lean domain DTO, no FHIR URIs |
| `TerminologySearchField` | Debounced SNOMED/ICD-10 picker with cross-mapping preview |
| `SearchInput` | Generic search input for filtering clinical lists |
| `ItemMeta` | Metadata display for clinical items |
| `ChangedBadge` | Visual indicator for modified fields |
| `MedicationCards` | Medication display cards |
| `PatientBanner` | Patient demographics header |
| `Modal` | Reusable modal for condition create/update |

### Hooks

| Hook | Purpose |
|------|---------|
| `useTerminologySearch` | Debounced (400ms) terminology search with in-memory cache, request cancellation, min 3 chars |
| `useClinicalSearch` | Generic client-side filter for clinical data lists (preserves null vs empty) |

---

## Cross-App Communication

| From | To | Mechanism |
|------|-----|-----------|
| admin-ui | workflow-ui | SSO code in URL hash: `/auth/sso-launch#sso_code=...&appId=...` |
| workflow-ui | admin-ui | Iframe re-login modal on session expiry |
| Both | admin-api | Auto-generated SDK clients (`@hs/admin-sdk`) |
| workflow-ui | bridge-api | Via `@hs/bridge-client` types |

## Auth Flow Summary

| App | Method | Details |
|-----|--------|---------|
| admin-ui | Direct signin | POST `/admin/auth/signin` → store tokens in localStorage |
| admin-ui | Auto-refresh | On 401 → `POST /oauth/token` grant_type=refresh_token |
| workflow-ui | OAuth PKCE | authorize → callback → exchange code + verifier |
| workflow-ui | SSO launch | admin-ui creates opaque SSO code → workflow-ui exchanges via PKCE |
| workflow-ui | Session expired | Shows iframe modal with admin-ui signin (no hard redirect) |
