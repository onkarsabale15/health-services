# Data Models (Prisma Schema)

## Core Models

### Organization
| Field | Type | Constraints |
|-------|------|------------|
| id | UUID | @id @default(uuid()) |
| name | String | |
| domain | String | @unique |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |
| **Relations** | users[], applications[] | |

### User
| Field | Type | Constraints |
|-------|------|------------|
| id | UUID | @id @default(uuid()) |
| email | String | @unique |
| passwordHash | String | |
| firstName | String | |
| lastName | String | |
| role | OrgRole | OWNER / ADMIN / MEMBER |
| status | UserStatus | PENDING / ACTIVE / DISABLED |
| organizationId | UUID | FK → Organization |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |
| **Relations** | organization, appAccess[] | |
| **Indexes** | @@index([organizationId]) | |

### Application
| Field | Type | Constraints |
|-------|------|------------|
| id | UUID | @id @default(uuid()) |
| name | String | |
| organizationId | UUID | FK → Organization |
| clientId | String | @unique |
| clientSecretHash | String? | |
| redirectUris | String[] | |
| allowedGrantTypes | String[] | |
| scopes | String[] | |
| tokenLifetime | Int? | |
| jwks | Json? | |
| appType | AppType | BRIDGE / CDS / WORKFLOW / CUSTOM |
| clientType | ClientType | PUBLIC / CONFIDENTIAL |
| smartLaunchUrl | String? | |
| cdsConfig | Json? | |
| llmConfig | Json? | |
| status | AppStatus | ACTIVE / DISABLED |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |
| **Relations** | organization, ehrAccess[], userAccess[], cdsRules[], workflows[], appTools[] |
| **Indexes** | @@index([organizationId]), @@index([appType]), @@index([id, organizationId]) |

### AppEhrAccess
| Field | Type | Constraints |
|-------|------|------------|
| id | UUID | @id @default(uuid()) |
| applicationId | UUID | FK → Application (onDelete: Cascade) |
| ehrName | String | |
| ehrTokenScopes | String[] | |
| prodEnvironment | Boolean | @default(false) |
| ehrConfig | Json? | |
| status | AppStatus | ACTIVE / DISABLED |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |
| **Relations** | application, sites[] | |
| **Indexes** | @@index([applicationId]), @@unique([applicationId, ehrName]) |

### EhrSiteConfig
| Field | Type | Constraints |
|-------|------|------------|
| id | UUID | @id @default(uuid()) |
| ehrAccessId | UUID | FK → AppEhrAccess (onDelete: Cascade) |
| name | String | |
| siteIdentifiers | Json | @default("{}") — tenant, accountId, siteId_ehr, etc. |
| siteCredentials | Json? | Sensitive per-site credentials |
| siteUrls | Json? | Per-site URL overrides |
| isDefault | Boolean | @default(false) |
| isActive | Boolean | @default(true) |
| isApproved | Boolean | @default(true) — bridge auto-created sites start unapproved |
| status | AppStatus | ACTIVE / DISABLED |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |
| **Relations** | ehrAccess | |
| **Indexes** | @@index([ehrAccessId]), @@unique([ehrAccessId, name]) |

### UserAppAccess
| Field | Type | Constraints |
|-------|------|------------|
| id | UUID | @id @default(uuid()) |
| userId | UUID | FK → User (onDelete: Cascade) |
| applicationId | UUID | FK → Application (onDelete: Cascade) |
| accessLevel | AccessLevel | READONLY / FULL |
| createdAt | DateTime | @default(now()) |
| **Relations** | user, application | |
| **Indexes** | @@index([userId]), @@index([applicationId]), @@unique([userId, applicationId]) |

### CoreEhrConnection (Prisma model, also cached in Redis at runtime)
| Field | Type | Notes |
|-------|------|-------|
| connectionId | UUID | @id @default(uuid()), maps to `core_ehrconnection` table |
| connectionName | String | |
| ehrName | String | EHR vendor identifier |
| appType | String | BRIDGE / CDS / WORKFLOW |
| grantType | String | |
| siteId | String? | |
| scope | String? | @db.Text |
| baseUrlTest | String? | EHR base URL (test env) |
| baseUrlProd | String? | EHR base URL (prod env) |
| authUrlTest | String? | EHR auth URL (test env) |
| authUrlProd | String? | EHR auth URL (prod env) |
| accessToken | String? | @db.Text |
| tenant | String? | |
| applicationName | String? | |
| enterpriseId | String? | |
| ngSessionId | String? | NextGen session |
| accountId | String? | |
| prodEnvironment | Boolean | @default(false) |
| organizationId | String? | |
| networkId | String? | |
| email | String? | |
| accessTokenGeneratedAt | DateTime? | |
| patient | String? | FHIR Patient ID |
| encounter | String? | FHIR Encounter ID |
| user | String? | EHR user identifier |
| createdAt | DateTime? | @default(now()) |
| updatedAt | DateTime? | @updatedAt |

## CDS Models

### CdsRule
| Field | Type | Constraints |
|-------|------|------------|
| id | UUID | @id @default(uuid()) |
| applicationId | UUID | FK → Application (onDelete: Cascade) |
| name | String | |
| description | String? | |
| hook | CdsHook | patient_view / encounter_start / etc. |
| fhirResources | String[] | |
| promptTemplate | String | @db.Text |
| modelProvider | String? | |
| modelName | String? | |
| isActive | Boolean | @default(true) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |
| **Relations** | application | |
| **Indexes** | @@index([applicationId]), @@index([hook]), @@index([applicationId, isActive]) |

## Workflow Models

### Workflow
| Field | Type | Constraints |
|-------|------|------------|
| id | UUID | @id @default(uuid()) |
| applicationId | UUID | FK → Application (onDelete: Cascade) |
| name | String | |
| description | String? | |
| nodes | Json | DAG node definitions |
| edges | Json | DAG edge connections |
| config | Json? | |
| triggerType | String | |
| version | Int | @default(1), auto-increments |
| status | WorkflowStatus | DRAFT / ACTIVE / DISABLED |
| isActive | Boolean | @default(true) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |
| **Relations** | application, executions[] | |
| **Indexes** | @@index([applicationId]), @@index([applicationId, isActive]) |

### WorkflowExecution
| Field | Type | Constraints |
|-------|------|------------|
| id | UUID | @id @default(uuid()) |
| workflowId | UUID | FK → Workflow (onDelete: Cascade) |
| status | ExecutionStatus | PENDING / RUNNING / COMPLETED / FAILED / CANCELLED |
| triggerInput | Json? | |
| stepResults | Json? | |
| output | Json? | |
| error | String? | |
| startedAt | DateTime? | |
| completedAt | DateTime? | |
| durationMs | Int? | |
| createdAt | DateTime | @default(now()) |
| **Relations** | workflow | |
| **Indexes** | @@index([workflowId]), @@index([status]), @@index([workflowId, createdAt]) |

### WorkflowTemplate
| Field | Type | Constraints |
|-------|------|------------|
| id | UUID | @id @default(uuid()) |
| name | String | @unique |
| description | String? | |
| category | String? | |
| nodes | Json | |
| edges | Json | |
| config | Json? | |
| isActive | Boolean | @default(true) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

### WorkflowTool
| Field | Type | Constraints |
|-------|------|------------|
| id | UUID | @id @default(uuid()) |
| name | String | @unique |
| displayName | String | |
| category | String? | |
| description | String? | |
| configSchema | Json? | |
| isActive | Boolean | @default(true) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |
| **Relations** | appTools[] | |

### AppToolAccess
| Field | Type | Constraints |
|-------|------|------------|
| id | UUID | @id @default(uuid()) |
| applicationId | UUID | FK → Application (onDelete: Cascade) |
| toolId | UUID | FK → WorkflowTool (onDelete: Cascade) |
| isEnabled | Boolean | @default(true) |
| createdAt | DateTime | @default(now()) |
| **Indexes** | @@index([applicationId]), @@unique([applicationId, toolId]) |

## Terminology Models

### IcdSnomedMapping
| Field | Type | Constraints |
|-------|------|------------|
| id | String | @id (SNOMED memberId) |
| isActive | Boolean | @default(true) |
| moduleId | String? | |
| effectiveTime | String? | |
| snomedCode | String | |
| snomedConceptName | String? | |
| icd10Code | String? | |
| icd10ConceptName | String? | |
| mapGroup | Int | |
| mapPriority | Int | |
| mapRule | String? | @db.Text |
| mapAdvice | String? | @db.Text |
| mapCategoryId | String? | |
| mapCategory | MapCategory? | |
| correlationId | String? | |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |
| lastSyncedAt | DateTime | @default(now()) |
| **Indexes** | @@index([snomedCode]), @@index([icd10Code]), @@index([mapCategory]), @@index([lastSyncedAt]) | |
| **Table** | @@map("icd_snomed_mappings") | |

## Enums

| Enum | Values |
|------|--------|
| OrgRole | OWNER, ADMIN, MEMBER |
| UserStatus | PENDING, ACTIVE, DISABLED |
| AppStatus | ACTIVE, DISABLED |
| AppType | BRIDGE, CDS, WORKFLOW, CUSTOM |
| ClientType | PUBLIC, CONFIDENTIAL |
| AccessLevel | READONLY, FULL |
| CdsHook | patient_view, encounter_start, order_select, order_sign, medication_prescribe |
| WorkflowStatus | DRAFT, ACTIVE, DISABLED |
| ExecutionStatus | PENDING, RUNNING, COMPLETED, FAILED, CANCELLED |
| MapCategory | PROPERLY_CLASSIFIED, CANNOT_BE_CLASSIFIED, CONTEXT_DEPENDENT, SOURCE_CONCEPT_AMBIGUOUS, OUTSIDE_SCOPE |

## FHIR Resource Mapping

| FHIR Resource | Bridge API Support | CDS Engine | Notes |
|---------------|:-:|:-:|-------|
| Patient | search, read, create | fhir_search, fhir_read | Core entity |
| Encounter | search, read, update | fhir_search, fhir_read | |
| Condition | search, read, create, update | fhir_search, fhir_read | |
| Observation | search, read | fhir_search, fhir_read | Labs, vitals |
| AllergyIntolerance | search, read | fhir_search, fhir_read | |
| MedicationRequest | search, read | fhir_search, fhir_read | |
| MedicationStatement | search, read | fhir_search, fhir_read | |
| Appointment | search, read | fhir_search, fhir_read | |
| Practitioner | search, read | fhir_search, fhir_read | |
| ServiceRequest | search, read | fhir_search, fhir_read | |
| Communication | search, read | fhir_search, fhir_read | |
| DocumentReference | search, read | fhir_search, fhir_read | |
| Coverage | search, read | fhir_search, fhir_read | Insurance |
| Location | search, read | fhir_search, fhir_read | |
| Task | search, read | fhir_search, fhir_read | |
