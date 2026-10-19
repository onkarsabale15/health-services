# Recipe — Add a Workflow Trigger Type

Trigger types tell workflow-app when to fire a workflow. Today: `manual`, `webhook`, `schedule`. Phase 4 of master roadmap adds `event` (clinical Kafka topics).

## Step 1 — Schema

`packages/infra/prisma/schema.prisma` — `Workflow.triggerSpec` is `Json?`. Add the new shape to the discriminated union in TypeScript types but no migration needed (`Json` is permissive).

```typescript
type TriggerSpec =
  | { type: 'manual' }
  | { type: 'webhook'; secret: string }
  | { type: 'schedule'; cron: string }
  | { type: 'event'; topic: string; filter?: string };  // NEW
```

## Step 2 — Listener

`apps/workflow-app/src/modules/triggers/{type}-trigger-listener.service.ts`:

```typescript
@Injectable()
export class XxxTriggerListenerService implements OnModuleInit {
  async onModuleInit() {
    // Subscribe to the source (Kafka topic, schedule, etc.)
  }

  async onTrigger(input: any) {
    // Find workflows with matching trigger spec
    const workflows = await this.findMatching(input);
    // Dispatch via existing `workflow.execute` topic
    for (const w of workflows) {
      await this.dispatcher.dispatch(w.id, { triggerInput: input });
    }
  }
}
```

## Step 3 — Filter / matching

For event triggers, the filter expression evaluates against the event payload. Keep grammar small (e.g., `payload.code in [...]`, `payload.value > 100`).

## Step 4 — Admin-UI selector

`apps/admin-ui/src/app/dashboard/workflows/[id]/_components/TriggerSelector.tsx` — extend with new trigger UX:
- Dropdown for trigger type
- Type-specific config UI (webhook URL display, cron editor, topic dropdown + filter editor)
- Live preview when applicable (e.g., recent matching events)

## Step 5 — Tests

- Listener spec: matching workflows dispatched on input; non-matching ignored
- Filter eval spec: each operator + edge cases
- E2E: define a workflow via UI, fire the trigger, observe execution

## Acceptance

- New trigger type selectable in workflow editor
- Workflow fires within 2s of trigger
- Multiple workflows on same trigger each fire independently
- Failed triggers don't crash the listener
