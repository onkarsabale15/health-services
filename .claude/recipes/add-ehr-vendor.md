# Recipe — Add a New EHR Vendor

End-to-end onboarding for a vendor (e.g., NextGen, eCW, Greenway). Three layers: ehr-data-service (HTTP), bridge-api (FHIR translation), cds-app provider (capability declaration).

## Prereqs

- Vendor official FHIR docs (auth, endpoints, ID semantics, write quirks).
- Vendor sandbox account or test creds.
- Decision: pure FHIR R4 or proprietary REST mapped to FHIR.

## Step 1 — Add vendor to config enum

`packages/config/src/ehrs.ts` — extend `EhrName` union with the new vendor key.

## Step 2 — ehr-data-service adapter

`packages/ehr-data-service/src/vendors/{vendor}/{vendor}.service.ts`:

```typescript
@Injectable()
export class XxxService extends BaseEhrService {
  ehrName = 'xxx' as const;

  async getAccessToken(siteId: string): Promise<string> {
    // Vendor-specific auth flow (OAuth2 client_credentials, basic auth, etc.)
  }

  async getPatient(siteId: string, patientId: string): Promise<EhrResponse<RawPatient>> {
    // Pure HTTP. No FHIR mapping. Return raw vendor payload.
  }

  // ... per-resource methods, raw passthrough only
}
```

Register in `packages/ehr-data-service/src/factory.ts` `EhrFactoryService`.

**Golden Path:** model after `packages/ehr-data-service/src/vendors/athenanet/`. Don't read other vendors unless debugging that specific vendor.

### Step 2a — Output type interfaces (NEW per `mcp-server-v2.md`)

`packages/ehr-data-service/src/vendors/{vendor}/{vendor}.types.ts` — plain TypeScript interfaces for each vendor response shape (`RawXxxPatient`, `RawXxxCondition`, etc.). No Zod. These are imported by:
- The vendor's `{vendor}.tools.ts` registry's `invoke` return types
- `apps/bridge-api/src/services/{vendor}/{vendor}.mapper.ts` as the input type for FHIR translation (single source of truth — bridge-api does NOT redefine these interfaces)

### Step 2b — Tool registry + input schemas (NEW per `mcp-server-v2.md`)

`packages/ehr-data-service/src/vendors/{vendor}/{vendor}.tools.ts` — plain object literal exporting `ToolRegistry<XxxService>`. One entry per method to expose as an MCP tool. Each entry: name (vendor-prefixed), description (multi-paragraph), `inputSchema` (Zod, inputs only), `invoke` (typed lambda calling the service method).

`packages/ehr-data-service/src/vendors/{vendor}/{vendor}.schemas.ts` — Zod input schemas extracted into reusable variables when shared across multiple tools (optional; inline in `tools.ts` is also fine).

Add the registry to `packages/ehr-data-service/src/tools/index.ts` `allVendorRegistries`. See `.claude/recipes/add-mcp-tool.md` for per-method detail.

## Step 3 — bridge-api FHIR mapping service

`apps/bridge-api/src/services/{vendor}/{vendor}-data.service.ts`:

```typescript
@Injectable()
export class XxxDataService implements IFhirDataService {
  async getPatient(siteId: string, patientId: string): Promise<Patient> {
    const raw = await this.xxxService.getPatient(siteId, patientId);
    return this.mapper.mapPatient(raw.data);
  }

  async createCondition(siteId: string, body: Condition, options?: WriteOptions): Promise<Condition> {
    const vendorPayload = this.mapper.toVendorCondition(body);
    const raw = await this.xxxService.createCondition(siteId, vendorPayload, options);
    return this.mapper.mapCondition(raw.data);
  }

  // ... resource methods
}
```

Mapper at `apps/bridge-api/src/services/{vendor}/{vendor}.mapper.ts` does FHIR R4 ↔ vendor translation. Use `@medplum/fhirtypes` for the FHIR side.

Register in `apps/bridge-api/src/services/ehr-factory.service.ts`.

## Step 4 — cds-app provider class

`apps/cds-app/src/modules/providers/{vendor}/{vendor}.provider.ts`:

```typescript
@Injectable()
export class XxxProvider extends StandardFhirR4Provider {
  override readonly ehrName = 'xxx';

  constructor(bridge: BridgeClientService, codingEnricher: FhirCodingEnricher) {
    super(bridge, codingEnricher);
  }

  override getCapabilities(_mode: LaunchMode): ProviderCapabilities {
    // Declare what this vendor supports.
    // Vendor-specific quirks (write rules, immutable fields, allowed states, etc.) live HERE.
    return { ... };
  }
}
```

Register in `apps/cds-app/src/modules/providers/providers.module.ts` `providers` array.

**Capability rule:** controllers / body builders / FE forms must NEVER branch on `ehrName`. They consume `getCapabilities()` output as data. See `.claude/rules/16-cds-capability-driven.md`.

## Step 5 — Cds-ui changes (none, by design)

If you've done steps 1–4 right, the FE forms automatically light up with the new vendor's capability matrix. No FE changes needed unless the vendor has a UI quirk that can't be expressed in the capability envelope (rare).

## Step 6 — Smoke tests

- Bridge: launch SMART against vendor sandbox; verify Patient/Condition/Observation read returns valid FHIR R4.
- cds-app: log into CDS via that vendor; verify capability envelope reflects what the provider class declared.
- Write smoke: POST a Condition end-to-end if writes are supported; verify EHR-side persistence (refetch, don't trust 200 alone — see `debug-cerner-write.md`).

## Acceptance

- Vendor name appears in admin-ui's EHR dropdown
- A site can be created for that vendor in admin-ui
- SMART launch from that vendor's sandbox completes
- Read all clinical data without errors
- Write capabilities match what the provider declared
