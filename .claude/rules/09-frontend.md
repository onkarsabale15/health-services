# Frontend Rules (admin-ui — Next.js 14 + Tailwind)

## Component Architecture

- **Pages** (`page.tsx`) are orchestrators — they compose sub-components, manage top-level state, and make API calls.
- **Sub-components** (`_components/`) handle UI rendering and user interaction — they receive data via props, never call API directly.
- **No component should exceed 300 lines.** Split at logical boundaries:
  ```
  applications/[id]/
  ├── page.tsx                    (orchestrator, ~100 lines)
  └── _components/
      ├── AppSettings.tsx         (settings form)
      ├── AuthMethodSection.tsx   (auth config)
      ├── EhrAccessList.tsx       (EHR table)
      └── DangerZone.tsx          (destructive actions)
  ```
- **Shared UI components** live in `src/components/`:
  - `Button` — shared button with variants (`primary`, `danger`, `success`, `warning`, `secondary`, `ghost`, `link`), sizes (`sm`, `md`), built-in loading spinner (`loading`/`loadingText`), and confirm dialog (`confirmMessage`). **Always use `<Button>` instead of raw `<button>` elements.**
  - `CopyButton` — copy-to-clipboard button with toast feedback. Uses `useToast()` internally. Accepts `className` and `iconClassName` for styling.
  - `StatusBadge` — colored status indicator
  - `ErrorAlert` — error banner
  - `Modal` — overlay dialog
  - `LoadingSpinner` — loading indicator
  - `ConfirmDialog` — confirmation before destructive actions
- **No logic duplication across pages.** Extract shared logic to `src/lib/` hooks or utilities.

### Button Component Usage

```typescript
// Primary with loading state
<Button variant="primary" loading={saving} loadingText="Saving...">Save</Button>

// Danger with confirmation dialog
<Button variant="danger" size="sm"
  confirmMessage="Delete this item? This cannot be undone."
  onClick={handleDelete}>
  Delete
</Button>

// Success action
<Button variant="success" size="sm" onClick={handleEnable}>Enable</Button>

// Warning action with confirm
<Button variant="warning" size="sm"
  confirmMessage="Rotate secret? The old one stops working immediately."
  onClick={handleRotate}>
  Rotate Secret
</Button>

// Ghost/cancel
<Button variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button>

// Text link (inline action)
<Button variant="link" size="sm" className="text-red-500 hover:text-red-700"
  confirmMessage="Revoke access?"
  onClick={handleRevoke}>
  Revoke
</Button>

// Copy button
<CopyButton text={someId} />
<CopyButton text={someId} className="text-blue-400 hover:text-blue-600 ..." />
```

### Button Anti-Patterns

| Anti-pattern | Correct Approach |
|-------------|-----------------|
| Raw `<button className="bg-blue-600 ...">` | `<Button variant="primary">` |
| `<button disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>` | `<Button loading={loading} loadingText="Saving...">Save</Button>` |
| `if (!confirm('...')) return;` in handler | `<Button confirmMessage="...">` on the component |
| Inline SVG copy icon with `navigator.clipboard` | `<CopyButton text={value} />` |
| Duplicated spinner `<div className="animate-spin ...">` | `<Button loading={true}>` |

## State Management

- Use React `useState` for component-level state. No Redux, Zustand, or Context API (except Toast).
- Use `localStorage` only for auth tokens (`token`, `refreshToken`, `user`) — never for application data.
- After mutations (create, update, delete), **update local state** — don't refetch the entire list:
  ```typescript
  // Good — optimistic update
  setApps(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a));

  // Bad — wasteful refetch
  await loadApps(); // re-fetches entire list from API
  ```
- Use `Promise.all()` for parallel API calls on page load:
  ```typescript
  const [apps, users] = await Promise.all([
    api.get('/applications'),
    api.get('/users'),
  ]);
  ```

## API Integration

- All API calls go through `lib/api.ts` (`ApiClient` singleton) — never use raw `fetch()`.
- Auto-refresh on 401 is handled by `ApiClient` — callers don't need to handle token refresh.
- **Type all API responses.** Define interfaces in `src/types/`:
  ```typescript
  // src/types/api.ts
  export interface Application {
    id: string;
    name: string;
    clientId: string;
    status: 'ACTIVE' | 'DISABLED';
    appType: 'BRIDGE' | 'CDS';
    // ...
  }

  // Usage
  const [apps, setApps] = useState<Application[]>([]);
  const data = await api.get<Application[]>('/applications');
  ```
- API base URL from env: `NEXT_PUBLIC_ADMIN_API_URL`.

## Error & Loading UX Standards

| Scenario | Pattern | Example |
|----------|---------|---------|
| **Page loading** | Loading spinner or skeleton centered on page | `if (loading) return <LoadingSpinner />` |
| **Mutation in progress** | Disable button + "Saving..." text | `<button disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>` |
| **Page-level error** | `<ErrorAlert>` banner above content | `{error && <ErrorAlert message={error} />}` |
| **Mutation error** | Toast notification | `toast(err.message, 'error')` |
| **Empty state** | "No {items} yet" with optional CTA | `{items.length === 0 && <EmptyState message="No apps yet" />}` |
| **Form validation** | Inline error below field | `{errors.name && <span className="text-red-500 text-xs">{errors.name}</span>}` |

- **Never silently swallow errors.** Every `.catch()` must either show a toast or log to Sentry.
- **Never render empty content without indication** — always show loading, empty, or error state.

## Styling

- **100% Tailwind CSS.** No inline `style={}` attributes, no CSS modules, no styled-components.
- Consistent class patterns:

  | Element | Classes |
  |---------|---------|
  | Primary button | `bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50` |
  | Danger button | `bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700` |
  | Ghost button | `text-gray-600 hover:text-gray-900 px-3 py-1` |
  | Text input | `w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500` |
  | Card | `bg-white rounded-lg shadow p-6` |
  | Badge (success) | `text-xs px-2 py-0.5 rounded bg-green-100 text-green-700` |
  | Badge (error) | `text-xs px-2 py-0.5 rounded bg-red-100 text-red-700` |
  | Badge (warning) | `text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700` |
  | Section heading | `text-lg font-semibold text-gray-900 mb-4` |
  | Divider | `border-t my-6` |

## Auth Flow

1. **Sign in:** POST `/admin/auth/signin` → receive `accessToken` + `refreshToken` → store in localStorage.
2. **Auto-refresh:** On 401 response, `ApiClient` automatically POST `/admin/auth/refresh` with stored refresh token.
3. **Sign out:** POST `/admin/auth/logout` → clear localStorage → redirect to `/auth/signin`.
4. **Route protection:** Dashboard layout checks for token on mount — redirects to signin if missing.
5. **Role-based UI:** Use `getUser().role` to conditionally render admin-only features.

## Performance

- **No unnecessary re-renders.** Use `useMemo` for filtered/sorted lists, `useCallback` for handlers passed as props.
- **Lazy load heavy components** if page size exceeds 500 lines after splitting.
- **Debounce search/filter inputs** (300ms) before triggering API calls.
- **Image optimization:** Use Next.js `<Image>` component for any images.
