# CDS UI — Full Build Specification

This is a single, self-contained instruction document for building the entire CDS UI — design tokens, shell, all routes, all components, animations, states, interactions. Follow every section in order.

---

## 0. Stack

- **Next.js 15 App Router** (existing — `apps/cds-ui`)
- **React 18+**, TypeScript strict
- **Tailwind CSS** (existing — tokens in `tailwind.config.ts`)
- **Framer Motion** — for all animations (`npm i framer-motion` — add to `apps/cds-ui/package.json`)
- **Material Symbols Outlined** — icons, loaded via Google Fonts (already in `globals.css`)
- **Inter** — font family (already configured)
- **Lucide React** — alternative icon set for crisp line icons (`npm i lucide-react`) — use for action bar + navigation; keep Material Symbols for clinical iconography

Animations MUST use Framer Motion, not CSS-only. Reason: declarative, gesture-aware, layout animations (`layoutId`), presence-aware (`AnimatePresence`).

---

## 1. Design Tokens

### Colors (use existing Tailwind palette at `tailwind.config.ts`)

- **Primary**: `#2b5bb5` (brand) — buttons, links, active nav, focused inputs
- **Primary dim**: `#1a4ea8` — gradient end, hover states
- **Surface**: `#f8f9ff` (body background), ladder of container tints up to `#d2e4ff`
- **Secondary**: `#526074` — muted text, icons at rest
- **Error**: `#9f403d` — destructive actions, error borders
- **Outline**: `#477dbb` / `#81b5f6` — input borders

**Add these new tokens to `tailwind.config.ts`:**

```typescript
colors: {
  // ... existing ...
  mode: {
    ehr:        '#16a34a',  // green — EHR launch
    standalone: '#7c3aed',  // purple — provider standalone
    system:     '#0891b2',  // cyan — system mode
  },
  status: {
    draft: '#64748b',
    active: '#059669',
    completed: '#2563eb',
    revoked: '#dc2626',
  },
  severity: {
    critical: '#dc2626',
    high:     '#ea580c',
    medium:   '#ca8a04',
    low:      '#0284c7',
    info:     '#64748b',
  },
},
boxShadow: {
  ambient:  '0 12px 40px rgba(0, 52, 94, 0.06)',   // existing
  elevated: '0 2px 8px rgba(0, 52, 94, 0.06), 0 8px 32px rgba(0, 52, 94, 0.04)',
  floating: '0 4px 16px rgba(0, 52, 94, 0.08), 0 16px 48px rgba(0, 52, 94, 0.06)',
  glow:     '0 0 0 4px rgba(43, 91, 181, 0.1)',    // focus ring
},
```

### Typography scale

- **Display**: `text-3xl/tight font-bold` (36px) — page titles
- **Headline**: `text-2xl/tight font-bold` (30px) — section headers
- **Title**: `text-lg font-semibold` (18px) — card titles
- **Body**: `text-sm` (14px) — default
- **Caption**: `text-xs` (12px) — secondary info
- **Label**: `text-[10px] uppercase tracking-widest font-bold` — taglines, badges, section labels

### Spacing (use Tailwind's 4px scale)

- **Page padding**: `px-8 py-6` (desktop), `px-4 py-4` (mobile)
- **Section gap**: `space-y-6` between cards
- **Card padding**: `p-6` (desktop), `p-4` (mobile)
- **Tight cluster**: `gap-2` for button groups
- **Dense list**: `gap-3` between list items

### Border radius

- **Cards**: `rounded-xl` (12px) — all cards
- **Buttons**: `rounded-xl` (12px) primary, `rounded-lg` (8px) secondary/ghost
- **Pills/badges**: `rounded-full`
- **Modal**: `rounded-2xl` (16px)
- **Inputs**: `rounded-lg` (8px)

### Motion tokens (Framer Motion presets)

Export these from a new file `apps/cds-ui/src/lib/motion.ts`:

```typescript
export const easeStandard = [0.4, 0.0, 0.2, 1];      // material standard
export const easeEmphasized = [0.2, 0.0, 0, 1];      // material emphasized
export const easeSpring = { type: 'spring', stiffness: 300, damping: 30 };

export const duration = {
  fast:    0.15,    // hover, focus, button press
  normal:  0.25,    // enter/exit, tab switches
  slow:    0.4,     // page transitions, modals
  deliberate: 0.6,  // first-paint animations
};

// Reusable variants
export const fadeInUp = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeStandard } },
};

export const fadeIn = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
};

export const scaleIn = {
  hidden:  { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: easeEmphasized } },
};

export const staggerChildren = {
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};

export const modalBackdrop = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

export const modalContent = {
  hidden:  { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.25, ease: easeEmphasized } },
  exit:    { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } },
};
```

**Animation principles (enforce in every component):**
- Durations: ≤250ms for UI chrome, ≤400ms for content, ≤600ms only for first-paint
- **Never animate `height: auto`** — use `grid-template-rows` trick or measure + animate
- **Always respect `prefers-reduced-motion`** — wrap `useReducedMotion()` once in the shell, short-circuit all transitions

---

## 2. App Shell

**File: `apps/cds-ui/src/app/app/layout.tsx`** (refactor existing)

### Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] Launcher  Patients  History  ...    [Mode]  [User]  │  ← Top bar (sticky, 56px)
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                     Route content                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│       footer: build version · doc link · feedback           │  ← Footer (optional, 40px)
└─────────────────────────────────────────────────────────────┘
```

- **Top bar**: sticky top, `bg-white/80 backdrop-blur-md border-b border-surface-container`, z-50
- **Content area**: `max-w-7xl mx-auto px-6 md:px-8 py-6`
- **Route transitions**: wrap `<main>` in `<AnimatePresence mode="wait">` with `motion.div` keyed on pathname using `fadeInUp` variant

### Top bar layout

**Left cluster:**
- Logo: `<Logo />` component, 32px square with primary gradient background + "CDS" monogram, `rounded-lg`
- Breadcrumb nav (if not on landing): `home / patients / {patientName}` — clickable, `text-xs text-secondary hover:text-surface-on`

**Right cluster:**
- **ModeBadge** (always visible when session active): see Component spec below
- **Switch Mode button** (when hybrid flow possible): ghost button "Switch mode ↗", opens modal
- **User menu** (avatar circle with initials): dropdown with Provider info, sign-out

### Animations on top bar

- Logo on hover: `scale: 1.05` with spring easing
- Nav links: underline slides in from left on hover (pseudo `::after` bar, animated via Framer Motion's `layoutId`)
- Mode badge: pulsing ring when session is <5min from expiring (amber) / <1min (red)
- Avatar dropdown: `scaleIn` from top-right anchor

---

## 3. Routes & Pages

### Route map

```
/                           → redirects to /auth/login OR /app (if session)
/auth/login                 → OTP login flow (email → code → session)
/app                        → routes to /app/launcher OR /app/patient/{id} based on session
/app/launcher               → EHR × mode picker (post-login landing)
/app/patient-search         → patient search (system/standalone modes)
/app/patient/[id]           → clinical summary (main clinical page)
/app/patient/[id]/analysis  → AI analysis in progress + results
/app/patient/[id]/history   → care plans for this patient
/app/history                → all care plans across patients
/app/history/[carePlanId]   → single care plan detail + editing
/app/settings (optional)    → provider preferences
```

---

### 3.1 `/auth/login` — OTP Login

**Layout:** centered card (max-w-md), vertically centered on page (`min-h-screen flex items-center`).

**States:**
1. Email entry
2. OTP entry (after email submitted)
3. Loading (submitting email / verifying code)
4. Error

**Email entry card:**
- Logo at top (large, 64px)
- Heading: "Welcome to Health Services CDS"
- Subtext: "Sign in with your work email"
- Email input with floating label animation (label moves from placeholder position to above input on focus/fill)
- Primary button: "Continue" — full width, 48px height
- Footer link: "Launched from your EHR? You'll land here automatically"

**OTP entry card (replaces email card with slide animation):**
- Back arrow (top-left, circular ghost button)
- Heading: "Check your email"
- Subtext: "We sent a 6-digit code to {email}"
- 6-box OTP input with auto-advance (use `react-otp-input` or build from scratch)
  - Each box: 48×56px, `rounded-lg border-2`, `text-2xl font-semibold text-center`
  - On focus: border becomes `primary` with `shadow-glow`
  - On fill: subtle bounce animation (scale 1.0 → 1.05 → 1.0, 200ms)
- Timer: "Resend in 0:58" — countdown, becomes clickable "Resend code" at 0:00
- Primary button: "Verify" — enabled when all 6 digits filled
- Error state: shake animation (x: [-4, 4, -4, 4, 0] over 300ms) + red border on all boxes

**Transitions between states:**
- Email → OTP: slide out left + fade (email card), slide in from right + fade (OTP card), 300ms, `easeEmphasized`
- Back to email: reverse direction

**First-paint animation on page load:**
- Logo scale from 0 → 1 (spring, delay 0)
- Card fade + slide up (delay 150ms)
- Form fields stagger (50ms each)

**API contract:**
- `POST /cds/auth/request-otp { email, applicationId }` → 200 `{ sent: true }` (always, anti-enumeration)
- `POST /cds/auth/verify-otp { email, applicationId, otp }` → 200 `{ token, user }` or 400 `{ error }`
- After verify: `POST /launch/system { token }` → creates CDS session cookie → redirect to `/app/launcher`

---

### 3.2 `/app/launcher` — EHR × Mode Picker

**Layout:**
```
┌────────────────────────────────────────────────────┐
│  Choose an EHR to launch                           │  ← page title
│  Select which EHR and launch mode you want to use  │  ← subtext
│                                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ Cerner     │  │ Epic       │  │ AthenaNet  │    │  ← EHR cards (grid, 3 cols on desktop)
│  │ [sys][pro] │  │ [sys]      │  │ [sys][pro] │    │
│  └────────────┘  └────────────┘  └────────────┘    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ NextGen    │  │ eCW        │  │ DrChrono   │    │
│  └────────────┘  └────────────┘  └────────────┘    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ Elation    │  │ Meditech   │  │ Greenways  │    │
│  └────────────┘  └────────────┘  └────────────┘    │
└────────────────────────────────────────────────────┘
```

**EhrLauncherCard** (see Component spec):
- Width: responsive — 1 col mobile, 2 col tablet, 3 col desktop
- Padding: `p-6`
- Border: `rounded-xl border border-surface-container hover:border-primary/40`
- Header: EHR logo (32px) + label
- Mode list: 1-3 mode buttons stacked
- Footer: capability pill row: ✓ Conditions · ✓ Allergies · ✗ Vitals

**Animations:**
- First-paint: cards stagger-appear with `fadeInUp` (stagger 80ms, starting 200ms after page mount)
- Hover: card lifts 4px + border color shifts to primary/40 + shadow from `ambient` → `elevated`, 200ms `easeStandard`
- Click on mode button:
  1. Button scales to 0.98 (press)
  2. Brief loading spinner replaces label ("Launching…")
  3. Card itself scales to 1.02, other cards fade to opacity 0.4 (500ms)
  4. Full-page transition to target route

**Empty state:** (no EHRs configured)
- Centered illustration (use a simple SVG icon: hospital building)
- "No EHRs configured yet"
- "Contact your administrator to configure EHR integrations"

**Data fetch:** `GET /api/launcher/integrations` on mount, show skeleton cards during load.

---

### 3.3 `/app/patient-search` — Patient Search

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Find patient                                           │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  🔍  Search by name, DOB, or MRN                  │ │  ← big search bar
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Results (12)                                           │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Avatar  John Smith  · Male · 1985-03-12 · MRN-123 │ │  ← patient row
│  │         Last visit: 2 days ago                    │ │
│  └───────────────────────────────────────────────────┘ │
│  ... more rows ...                                      │
└─────────────────────────────────────────────────────────┘
```

**Search bar:**
- Full width, `h-14` (taller than default), `rounded-xl`, `border-2`, padding `pl-14 pr-6`
- Icon inset left (search icon, 20px)
- Debounced 300ms
- Shows three filter pills below: `[All]` `[Name]` `[DOB]` `[MRN]` — click to scope the search
- On typing: input border animates to primary
- Clear button appears on fill (×, right side, fades in)

**Results list:**
- Each row: `rounded-lg border-b hover:bg-surface-container-low px-4 py-3 cursor-pointer`
- Avatar: circle with initials (use deterministic color from name hash)
- Hover: background tint, slide right by 4px (indicates clickable)
- Click: row scales to 0.98 briefly, then route to `/app/patient/{id}`

**Loading state:**
- 5 skeleton rows animating (shimmer effect, 1.5s loop)

**Empty state:**
- Centered icon + "No patients found matching '{query}'"
- Suggestions: "Try searching by MRN or last name"

**Animations:**
- Results stagger-appear when query returns (30ms per row)
- When user types a new query, old results fade out (150ms), new results fade in (200ms, stagger)

---

### 3.4 `/app/patient/[id]` — Clinical Summary (PRIMARY PAGE)

This is the most important page. Every mode lands here.

**Layout (responsive):**
```
┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────┐ │
│  │  PatientBanner                                        │ │  ← sticky at top of content
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ClinicalActionBar: [+ Condition] [+ Allergy] [+ Vital] [Close Encounter] [Generate Care Plan]
│                                                             │
│  ┌─────────────────────┐  ┌──────────────────────────────┐ │
│  │  Conditions (4)     │  │  Allergies (2)               │ │  ← 2-col grid on desktop
│  │  • Hypertension     │  │  • Penicillin — severe       │ │
│  │  • T2 Diabetes      │  │  • Peanuts — moderate        │ │
│  │  • ...              │  │                              │ │
│  └─────────────────────┘  └──────────────────────────────┘ │
│  ┌─────────────────────┐  ┌──────────────────────────────┐ │
│  │  Medications (6)    │  │  Vitals — 2d ago             │ │
│  │  • Metformin 500mg  │  │  BP 120/80  HR 72  Temp 98.6 │ │
│  │  • ...              │  │                              │ │
│  └─────────────────────┘  └──────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  AI Analysis                                          │ │
│  │  (Cards list or "Run analysis" CTA)                   │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**PatientBanner:** (reuse existing, enhance)
- Height: 100px
- Background: gradient `from-primary/5 to-primary-container/20`
- Avatar: 64px circle, initials, color from name hash
- Name: `text-xl font-bold`
- Meta row: `age · gender · DOB · MRN · phone`
- Right side: stat chips (allergies count in red, conditions count, meds count)
- Sticky behavior: on scroll, collapses to 60px tall with smaller avatar (use Framer Motion's `useScroll` + `useTransform`)

**ClinicalActionBar:** (NEW)
- Row of CapabilityGatedButton components
- Sticky below PatientBanner
- Each button: icon + label, `rounded-xl`, `h-10`, `px-4`
- Buttons group: `flex gap-2 flex-wrap`
- On small screens (≤ md): collapses to a single "Actions ▾" dropdown button

**Clinical sections (4 cards: Conditions, Allergies, Meds, Vitals):**
- Each card: `cds-card p-6`
- Each card has an independent loader (skeleton rows)
- Sections load in parallel — cards appear as data arrives with `fadeInUp`
- Empty section: "No conditions recorded" centered in card, grey, with icon

**Card header pattern:**
```
  🩺  CONDITIONS (4)                       [+ Add]
  ─────────────────────────────────────────────────
```
- Icon: primary color, `material-symbols-outlined`
- Label: `text-[10px] uppercase tracking-widest font-bold text-secondary`
- Count badge
- Action link on right (ghost button)

**Condition list item:**
```
  ┌─────────────────────────────────────────┐
  │ ▌ Hypertension                  [Active] │
  │   I10 · Primary Care · 2 months ago      │
  └─────────────────────────────────────────┘
```
- Left border: 3px, color by severity (red for critical, amber for warning, grey otherwise)
- Hover: background `bg-surface-container-low`, 150ms

**Animations:**
- Section cards stagger-appear (100ms between each) on mount
- Each item within a card fades in with 30ms stagger
- Refresh button on a card: icon rotates 360° on click, card contents fade → refill

**Loading states:**
- Skeleton with shimmer animation
- Rows are `h-4 bg-surface-container rounded animate-pulse` with staggered widths (70%, 85%, 60%, 90%)

**Data fetches:** 5 parallel requests via `Promise.allSettled`, each section updates independently.

---

### 3.5 `/app/patient/[id]/analysis` — AI Analysis

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  PatientBanner (compact)                                │
│                                                         │
│  AI Care Plan                                           │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 🔄 Analyzing...                                   │ │  ← during analysis
│  │ [=============>              ] 60%                │ │
│  │ Reading conditions, allergies, medications...     │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  OR (after analysis)                                    │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Card 1 — Drug Interaction Warning      [Critical] │ │
│  │ Metformin + Lisinopril — monitor potassium        │ │
│  │ [Details ▾]                                       │ │
│  └───────────────────────────────────────────────────┘ │
│  ... more cards ...                                     │
│                                                         │
│  [Approve Care Plan] [Revoke] [Export PDF] [Re-analyze]│
└─────────────────────────────────────────────────────────┘
```

**Loader state:**
- Custom loading component (not generic spinner)
- Progress bar showing % (based on which resource is being fetched)
- Rotating text: "Reading conditions..." → "Reading allergies..." → "Generating recommendations..."
- Use Framer Motion to animate each text swap with `AnimatePresence mode="wait"`
- Subtle pulsing gradient background behind the loader

**Card list (CdsCardList):**
- Each card: left-border color by severity
- Cards stagger in as they arrive (150ms each)
- Each card can be expanded/collapsed with height animation (use Framer Motion's `layout` prop)
- Click on card: expands inline, other cards don't collapse
- Drag to reorder (optional — use `framer-motion` `Reorder.Group`)

**Action bar at bottom:**
- Sticky, floating above content
- Approve: primary button with green tint
- Revoke: danger button (outlined red, fills red on hover) — opens modal asking for reason
- Export PDF: ghost button with download icon
- Re-analyze: opens modal for optional instructions, triggers new analysis

**Partial-data warning banner** (if applicable):
- Amber, at top of card list
- "Generated with partial data — no medication list available for Athenanet"
- Icon + dismissable (×)

---

### 3.6 Care plan pages (`/app/history/*`, `/app/patient/[id]/history`)

**All care plans list:**
- Table layout: Patient · Title · Status · Created · Generated By · Actions
- Search bar above
- Filters: status dropdown, date range picker
- Row hover: `bg-surface-container-low`, cursor pointer
- Click row: navigate to detail

**Care plan detail:**
- Header: title (editable inline), status badge, created date
- Audit section: "Generated by {ai-model} · Approved by {provider} on {date} · Last edited by {name}"
- Cards list (identical to analysis page but editable)
- Actions: same as analysis page

**Editable title:**
- Click pencil icon → input appears inline
- Escape: revert; Enter or blur: save
- Loading indicator during save (small spinner next to title)
- Success: brief green checkmark fade in/out (500ms)

---

## 4. Component Specifications

### 4.1 ModeBadge

**Props:** `{ mode: 'ehr' | 'standalone' | 'system', ehrName: string, providerName?: string, expiresAt?: Date }`

**Layout:** pill with dot + text, `px-3 py-1.5 rounded-full`
```
  ● EHR · Cerner                        ← green dot (live)
  ● Standalone · Cerner · Dr Smith      ← purple dot
  ● System · Cerner · Site A            ← cyan dot
```

**Colors per mode:** use `mode.ehr` / `mode.standalone` / `mode.system` tokens.

**Expiry indicator:**
- >5min remaining: static
- <5min: dot pulses (opacity 1 → 0.4 → 1 on 2s loop, amber)
- <1min: dot pulses faster (1s loop, red), and tooltip "Session expiring soon — save work"

**Click behavior:** opens a popover showing:
- Full session details
- "Switch mode" button (if applicable)
- "Sign out" button

---

### 4.2 CapabilityGatedButton

**Props:**
```typescript
{
  operation: ClinicalOperation;
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
}
```

**Behavior:**
1. Reads current session `(ehrName, launchMode)` from `useSession()`
2. Calls `canPerform(ehrName, operation, launchMode)` from `@hs/config/ehr-capabilities`
3. If `supported: false`:
   - Button renders with `disabled` styling, `opacity-50 cursor-not-allowed`
   - On hover: tooltip appears above with `reason` text, 100ms delay, `fadeIn` animation
4. If `supported: true` but another mode is `preferred`:
   - Button renders normally
   - Adds a small info icon next to label with tooltip: "Best in {preferredMode} launch"

**Tooltip component:**
- Black/90 background, white text, `rounded-md px-3 py-1.5 text-xs`
- Max width 240px, wraps
- Arrow pointing down at button
- Position: above button (or flip to below if near top of viewport)
- Enter: `opacity 0 → 1, scale 0.95 → 1, translateY 4px → 0`, 150ms
- Exit: reverse, 100ms

---

### 4.3 EhrLauncherCard

**Props:**
```typescript
{
  ehrName: string;
  label: string;
  logoUrl?: string;
  modes: Array<{
    appType: 'system' | 'provider-ehr' | 'provider-standalone';
    enabled: boolean;
    integrationId: string;
  }>;
  capabilities: {
    canReadClinical: boolean;
    canWriteConditions: boolean;
    canWriteAllergies: boolean;
    canWriteVitals: boolean;
    canGenerateCarePlans: boolean;
  };
  onModeClick: (appType: string) => void;
}
```

**Layout:**
```
┌──────────────────────────────────────┐
│  [Logo]  Oracle Health (Cerner)      │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ System Access                  │  │  ← mode button
│  │ Browse patients across clinic  │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ Standalone Launch              │  │
│  │ Full clinical session          │  │
│  └────────────────────────────────┘  │
│  · EHR Launch · launched from EHR    │  ← disabled, inline text
│                                      │
│  Can do: conditions, allergies,      │
│         vitals, care plans           │
└──────────────────────────────────────┘
```

**Mode button (within card):**
- Full width, 2-line layout (title + subtext)
- `rounded-lg border-2 border-transparent bg-surface-container-low hover:border-primary hover:bg-white`
- Hover: subtle lift (translateY -2px)
- Click: scale 0.98, show spinner, label → "Launching..."

**Capability row:**
- 5 small icons + checkmark/x
- `flex gap-2 text-xs text-secondary`

**Animations:**
- Card enters with `fadeInUp`, stagger within grid
- Hover state: lift + border color + shadow change, 200ms
- Mode button hover: slightly expand (scale 1.02)
- Click: transition to route with cross-fade

---

### 4.4 PatientBanner (existing, enhance)

**Sticky collapse on scroll:**
- Initial: 100px tall, avatar 64px, name `text-xl`
- After 100px scroll: 56px tall, avatar 32px (inline left), name `text-sm`
- Smooth transition using Framer Motion's `useTransform(scrollY, [0, 100], [100, 56])`

**Stat chips animation:**
- Allergies count: pulsing red dot next to number if > 0
- Chips stagger-fade on load

---

### 4.5 Modal

**Use Framer Motion for enter/exit:**
- Backdrop: `fadeIn` 200ms, `bg-black/40 backdrop-blur-sm`
- Content: `modalContent` variant (scale + slide)
- Exit: reverse, 200ms
- Escape key closes
- Click backdrop closes
- Focus trap inside
- Scroll locks on `<body>`

**Structure:**
```
┌─────────────────────────────────┐
│  Title                      ×   │
├─────────────────────────────────┤
│                                 │
│  Body content (scrollable)      │
│                                 │
├─────────────────────────────────┤
│  [Cancel]          [Primary]    │
└─────────────────────────────────┘
```

---

### 4.6 Toast

**Mount a single `ToastProvider` in `layout.tsx`.**

**Toast spec:**
- Slides in from top-right
- Max width 400px
- `rounded-xl p-4 shadow-floating`
- Left border: color by type (success=green, error=red, warning=amber, info=blue)
- Auto-dismiss: 4s (success), 6s (error), 5s (warning/info)
- Pause on hover
- Close button
- Stack of up to 3 toasts, older ones fade

**Animation:** slide in from right (+20px), fade in, 250ms `easeEmphasized`; exit reverse, 200ms.

---

### 4.7 Skeleton

**Shimmer effect:**
```css
background: linear-gradient(90deg,
  hsl(210, 20%, 94%) 0%,
  hsl(210, 20%, 97%) 50%,
  hsl(210, 20%, 94%) 100%);
background-size: 200% 100%;
animation: shimmer 1.5s infinite;

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Variants:** Text line (h-3 or h-4 rounded), Avatar (circle), Card (full card shape), Button.

---

### 4.8 ClinicalActionBar

**Layout:** flex row, wrap on small screens
```
[+ Add Condition] [+ Add Allergy] [+ Record Vital] [Close Encounter] [✨ Generate Care Plan]
```

**Sticky behavior:**
- Sticks below PatientBanner (which is also sticky)
- Background: `bg-surface/90 backdrop-blur-md`
- Border bottom: `border-b border-surface-container`

**Responsive:**
- Desktop: full row
- Tablet: 2-row grid
- Mobile: "Actions ▾" dropdown button reveals list

**Animation:** buttons fade-in staggered on mount (30ms each).

---

### 4.9 AddConditionModal / AddAllergyModal / RecordVitalModal

All follow same pattern: Modal + multi-step form.

**AddConditionModal:**
1. Step 1 — Search for code (ICD-10 / SNOMED) via `/terminology/icd10?q=`
   - Autocomplete input with live results
   - Each result: code + description
2. Step 2 — Category: `[Problem List]` or `[Encounter Diagnosis]` (disabled if EHR doesn't support one)
3. Step 3 — Severity (optional), onset date (optional)
4. Preview + Save

**Step transitions:** slide left/right (like OTP modal).

---

### 4.10 CdsCard (AI recommendation card)

```
┌─────────────────────────────────────────┐
│ ▌ 🚨 Drug Interaction              [⋮]   │
│   High · Primary Care                   │
│                                         │
│   Metformin + Lisinopril                │
│   Monitor potassium levels weekly       │
│                                         │
│   [+ Add Observation] [Dismiss]         │
│                                         │
│   ── Details ▾ ──                       │
│   (collapsed by default, expand on click)│
└─────────────────────────────────────────┘
```

**Severity-colored left border:** 3px, color per severity token.

**Expand/collapse:**
- Click header or "Details" → expands inline
- Uses `motion.div` with `layout` prop for smooth height animation
- Chevron rotates 0° → 180°

**Drag to reorder (optional):**
- Use Framer Motion's `Reorder.Group` and `Reorder.Item`
- Grip handle on the right

---

## 5. Interaction Patterns

### 5.1 Button press

All buttons: `active:scale-[0.98]` via Tailwind. For Framer Motion buttons, use `whileTap={{ scale: 0.98 }}`.

### 5.2 Input focus

- Border color: primary
- Box shadow: `shadow-glow` (subtle primary ring)
- Transition: 150ms

### 5.3 Page transition

Wrap route content in:
```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={pathname}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2, ease: easeStandard }}
  >
    {children}
  </motion.div>
</AnimatePresence>
```

### 5.4 List stagger

Use `staggerChildren`:
```tsx
<motion.ul variants={staggerChildren} initial="hidden" animate="visible">
  {items.map(item => (
    <motion.li key={item.id} variants={fadeInUp}>{item.content}</motion.li>
  ))}
</motion.ul>
```

### 5.5 Error animations

- Form field with invalid input: shake (`x: [-4, 4, -4, 4, 0]`, 300ms) + red border flash
- Full-page error: error icon scales in (spring), message fades in, "Try again" button appears after 300ms delay

### 5.6 Success animations

- Checkmark SVG draws in (stroke-dashoffset animation) over 400ms
- Brief pulse of green background (200ms)
- Fade out after 1.5s

---

## 6. Data Flow

### 6.1 API client

**File: `apps/cds-ui/src/lib/api.ts`** (existing) — single singleton, typed methods.

### 6.2 Session state

**File: `apps/cds-ui/src/hooks/useSession.ts`** (create if not existing)

- Fetches `/api/clinical-data/session` on mount
- Stores in Zustand or React Context (no external library needed — just Context)
- Exposes: `{ ehrName, launchMode, patientId, encounterId, providerName, expiresAt }`
- Auto-refresh every 2 minutes
- On 401: redirect to login

### 6.3 Clinical data fetching

Per-section `useEffect` calls — no global store. Each section manages its own loading/error state. Reason: sections are independent (loading speeds vary wildly).

Example for Conditions:
```tsx
const [conditions, setConditions] = useState<Condition[] | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  cdsApi.getConditions(patientId)
    .then(setConditions)
    .catch(e => setError(e.message))
    .finally(() => setLoading(false));
}, [patientId]);
```

### 6.4 Mutations (writes)

Use optimistic updates:
1. Add item to local state immediately
2. Call API
3. On success: replace with server response (gives real ID)
4. On error: remove item, show toast, optionally keep in a "retry" UI

---

## 7. Responsive Behavior

**Breakpoints (Tailwind defaults):**
- `sm`: 640px — phone landscape
- `md`: 768px — tablet
- `lg`: 1024px — laptop
- `xl`: 1280px — desktop
- `2xl`: 1536px — large desktop

**Rules:**
- Mobile-first CSS (start with mobile styles, add `md:` overrides)
- Patient page: 2-column grid at `lg+`, stacked below
- Launcher page: 3 cols at `lg+`, 2 cols at `md`, 1 col below
- Top bar: hamburger menu below `md`, full nav above
- Clinical action bar: horizontal scroll at `sm`, wrapped rows at `md`, full inline at `lg+`

---

## 8. Accessibility

- **Semantic HTML**: `<main>`, `<nav>`, `<article>`, `<button>` (not `<div>` with click)
- **ARIA labels** on icon-only buttons
- **Keyboard navigation**: all interactive elements focusable, visible focus ring (`focus-visible:ring-2 ring-primary`)
- **Focus trap** in modals
- **Escape key** closes modals, dropdowns, tooltips
- **Color contrast**: primary on white = 4.8:1 (AA), text-secondary = 4.5:1 (AA)
- **Reduced motion**: wrap all Framer Motion animations so they short-circuit when `prefers-reduced-motion: reduce`
- **Screen reader announcements** for state changes (session expiring, data loaded, errors)

---

## 9. Dark Mode (optional but recommended)

Add `.dark` variant in Tailwind config. Re-define tokens with darker values:
- `surface`: `#0f1419`
- `surface-container`: ladder `#1a2332` → `#2a3a54`
- `surface-on`: `#e8f0fe`
- `primary`: `#8cb4ff` (brighter for dark backgrounds)

Toggle via system preference + user override in settings.

---

## 10. Performance

- **Code splitting**: Next.js App Router does this automatically per route
- **Image optimization**: use Next.js `<Image>` for logos
- **Lazy load**: heavy modals (AI analysis config, PDF export) via `next/dynamic`
- **Memoize**: clinical summary sections with `React.memo`
- **Debounce**: search inputs (300ms)
- **Prefetch**: next likely route on hover (Next's Link already does this)

---

## 11. Testing

- **Visual regression**: Chromatic / Percy on key components (EhrLauncherCard, PatientBanner, CdsCard)
- **Interaction tests**: React Testing Library for forms, modals, navigation
- **Capability gating**: test `CapabilityGatedButton` with various `(ehrName, mode, operation)` combos
- **Accessibility**: run `axe-core` in CI

---

## 12. Build & Deploy

- `npm run dev` — local dev server at `http://localhost:3004`
- `npm run build` — production build
- `npm run lint` — ESLint + TypeScript check

---

## Summary — Animation Checklist

Every interactive element should have at least one of:
- [ ] Hover animation (color/position/shadow)
- [ ] Press animation (scale)
- [ ] Loading state (spinner, shimmer, progress)
- [ ] Enter animation (fade, slide)
- [ ] Exit animation (fade, scale)
- [ ] Error animation (shake, color flash)
- [ ] Success animation (checkmark, pulse)

Every page should have:
- [ ] First-paint stagger animation
- [ ] Smooth route transition in/out
- [ ] Loading skeleton with shimmer
- [ ] Error state with recovery action
- [ ] Empty state with next-step hint

---

## Quick-start implementation order

1. **Install deps**: `npm i framer-motion lucide-react` in `apps/cds-ui`
2. **Create `lib/motion.ts`** with variants
3. **Create design tokens** (extend `tailwind.config.ts`)
4. **Build shell** (`app/app/layout.tsx` + `ModeBadge` + top bar)
5. **Build landing** (`app/app/launcher/page.tsx` + `EhrLauncherCard`)
6. **Build login** (`app/auth/login/page.tsx` with OTP)
7. **Build patient page** (`app/app/patient/[id]/page.tsx` + sections + `ClinicalActionBar` + `CapabilityGatedButton`)
8. **Build modals** (AddCondition, AddAllergy, RecordVital)
9. **Build analysis page** (`app/app/patient/[id]/analysis/page.tsx`)
10. **Build care plan pages** (`app/history/*`)
11. **Polish**: animations, responsive, accessibility, dark mode
