# Recipe — Add an Admin-UI Page

Capability-aware, role-gated, generated SDK.

## Step 1 — Backend controller (if data is needed)

`apps/admin-api/src/modules/{module}/{module}.controller.ts`:

```typescript
@Controller('xxx')
@AllowTokenTypes('session')
@UseGuards(SessionGuard)
@ApiTags('Xxx')
@ApiBearerAuth()
export class XxxController {
  @Get()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async list(@CurrentUser() user: any) {
    // Tenant isolation: include user.orgId in WHERE
  }
}
```

DTO with class-validator. Response typed.

## Step 2 — Regenerate SDK

```bash
npm run generate:sdk -w apps/admin-ui  # or whatever the project's regen command is
```

The typed client appears at `apps/admin-ui/src/lib/sdk/generated/{module}-controller.ts`.

## Step 3 — Page component

`apps/admin-ui/src/app/dashboard/{section}/page.tsx`:

```typescript
'use client';
import { useEffect, useState } from 'react';
import { xxxControllerList } from '@/lib/sdk/generated';
import { useToast } from '@/components/toast';
import { getUser } from '@/lib/auth';

export default function XxxPage() {
  const { toast } = useToast();
  const user = getUser();
  const [items, setItems] = useState<XxxResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await xxxControllerList();
      if (error) throw new Error((error as any).message);
      setItems(data ?? []);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally { setLoading(false); }
  }

  // role-gated UI: only OWNER/ADMIN see destructive actions
  const canDelete = user?.role === 'OWNER' || user?.role === 'ADMIN';

  if (loading) return <LoadingSpinner />;
  if (items.length === 0) return <EmptyState message="No Xxx yet" />;
  // ...
}
```

## Step 4 — Subcomponents

Split if the page exceeds ~300 lines. Place sub-components in `_components/`.

## Step 5 — Navigation

Add to the dashboard sidebar (`apps/admin-ui/src/app/dashboard/_components/Sidebar.tsx` or equivalent).

## Step 6 — Use shared components

- `<Button>` (variants, loading, confirm dialogs)
- `<CopyButton>`
- `<StatusBadge>`, `<ErrorAlert>`, `<Modal>`, `<LoadingSpinner>`, `<ConfirmDialog>`
- Tailwind classes per `09-frontend.md`

## Step 7 — Tests

- Backend controller spec: tenant isolation, role gating, edge cases
- E2E: page loads, table renders, empty state, error state

## Acceptance

- Page accessible only to OWNER/ADMIN (or whatever role gate)
- Cross-tenant access returns 403
- Empty / loading / error states all rendered
- Mutations update local state, not refetch the entire list
