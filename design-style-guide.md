# NextGen SACCO — Design Style Guide

> Single source of truth for all visual and interaction decisions in NextGen SACCO. Reference this file before writing any UI code.
>
> **Aesthetic**: Dark-first Premium Fintech (private-banking / lending-platform school)
> **Scope**: Staff Dashboard, Member Portal, Loan Agreement PDFs, Statement PDFs, Email Templates

---

## Visual Reference

The reference is a dark-mode lending-platform admin dashboard (a "Proloans" member profile screen). Near-black background, charcoal cards with soft rounded corners and minimal borders, generous whitespace, bold white headline numbers set in tabular figures, a monochrome UI relieved only by a single warm amber/orange accent dot for the active nav item and semantic green for positive states ("Excellent" credit score). Rounded-pill black buttons ("Modify Details", "Update Loan"), a pill search bar, and small rounded-corner thumbnail imagery for loan-type cards (home, car, business). The overall mood is quiet, confident, and premium — closer to a private bank's internal tool than a typical SaaS dashboard. Every token below is built to match this reference exactly.

---

## 1. Design Philosophy

NextGen SACCO must feel like software a Ugandan bank examiner would trust — precise, calm, and unmistakably serious about money — while remaining approachable for SACCO staff who are not full-time software users.

**Three core principles:**

1. **Monochrome authority, sparing accent** — The interface runs almost entirely in near-black, charcoal, and white. Amber is reserved for active/selected states; green and red are reserved strictly for financial semantics (paid vs. overdue, positive vs. negative). Nothing decorative competes with the numbers.
2. **Numbers are the hero** — Loan amounts, balances, and rates are always large, bold, and tabular. A SACCO officer should be able to scan a screen and read the money first.
3. **Quiet confidence, banking discipline** — Soft shadows over hard borders, generous card padding, no gradients, no emoji, no playful motion. Every status must be legible without relying on color alone (accessibility for long shifts and low-light branch offices).

---

## 2. Typography

### Font Family

**Primary font: [Inter](https://fonts.google.com/specimen/Inter)** (Google Fonts)

Load via `next/font/google`:

```tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
```

Apply via `className={inter.variable}` on the root layout and reference it in Tailwind config as the default sans font.

**Why Inter**: extremely legible at small sizes, excellent tabular numerals for money and IDs, well-supported in `@react-pdf/renderer` for loan agreements and statements, and reads as neutral/professional rather than trendy — appropriate for a financial institution.

### Type Scale

| Style | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| `display` | 44px | 600 | 1.1 | -0.02em | Landing hero, marketing |
| `display-sm` | 32px | 600 | 1.15 | -0.02em | Section headers on landing |
| `h1` | 28px | 600 | 1.2 | -0.015em | Page titles in dashboard |
| `h2` | 22px | 600 | 1.25 | -0.01em | Section headings |
| `h3` | 18px | 600 | 1.3 | -0.005em | Card titles, modal titles |
| `h4` | 15px | 600 | 1.4 | 0 | List item titles, labels |
| `body-lg` | 16px | 400 | 1.55 | 0 | Marketing body copy |
| `body` | 14px | 400 | 1.5 | 0 | Default dashboard body text |
| `body-sm` | 13px | 400 | 1.5 | 0 | Secondary info, table data |
| `caption` | 12px | 500 | 1.4 | 0.01em | Meta, timestamps, badges |
| `micro` | 11px | 600 | 1.3 | 0.04em | Uppercase labels, eyebrows (uppercase) |
| `tabular` | 14px | 500 | 1.5 | 0 | Numbers, amounts — use `font-variant-numeric: tabular-nums` |
| `stat-value` | 32px | 700 | 1.1 | -0.02em | Dashboard KPI figures, loan balances |

**Rules:**
- Headings use weight 600, never 700 or 800 in UI chrome (avoid aggressive) — 700 is reserved for `stat-value` money figures only.
- **Always** use `tabular-nums` for UGX amounts, member numbers, loan numbers, NINs, and dates.
- Line-height: tighter (1.1–1.3) for display/headings, 1.5 for body.
- All currency values are prefixed `UGX` (never a bare number, never `$`), e.g. `UGX 4,250,000`.

---

## 3. Color Palette

NextGen SACCO ships **dark mode as the default** and light mode as a fully supported alternative (toggle in sidebar). Tokens below define both.

### Base Surface — Dark (default)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-canvas` | `#0A0A0A` | Page background |
| `bg-surface` | `#141414` | Sidebar, top bar background |
| `bg-card` | `#171717` | Card background |
| `bg-card-hover` | `#1D1D1D` | Card hover / row hover |
| `bg-input` | `#1A1A1A` | Input backgrounds |
| `border-subtle` | `#262626` | Card borders, dividers |
| `border-strong` | `#333333` | Input borders, focus-adjacent borders |
| `text-primary` | `#FAFAFA` | Headings, primary text, KPI values |
| `text-secondary` | `#A1A1A1` | Secondary text, captions, labels |
| `text-muted` | `#6B6B6B` | Placeholder, disabled text |

### Base Surface — Light

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-canvas` | `#F7F7F5` | Page background |
| `bg-surface` | `#FFFFFF` | Sidebar, top bar background |
| `bg-card` | `#FFFFFF` | Card background |
| `bg-card-hover` | `#F4F4F3` | Card hover / row hover |
| `bg-input` | `#FFFFFF` | Input backgrounds |
| `border-subtle` | `#E7E5E1` | Card borders, dividers |
| `border-strong` | `#D4D1CB` | Input borders |
| `text-primary` | `#141414` | Headings, primary text |
| `text-secondary` | `#5C5C5C` | Secondary text, captions |
| `text-muted` | `#9A9A9A` | Placeholder, disabled text |

### Accent (Amber — used sparingly)

| Token | Hex | Usage |
|-------|-----|-------|
| `accent-400` | `#F5A94E` | Active nav dot, active tab underline |
| `accent-500` | `#E8963A` | Primary interactive accent (rare — links, focus highlight on brand elements) |
| `accent-600` | `#C97A24` | Accent hover/pressed |
| `accent-soft` | `#2A2013` (dark) / `#FDF3E5` (light) | Accent background wash (badges, highlight rows) |

### Semantic

| Token | Hex (dark) | Hex (light) | Usage |
|-------|-----|-----|-------|
| `success-600` | `#3FB950` | `#1A8A3D` | Paid, active, on-time, positive cash flow |
| `success-soft` | `#122117` | `#EAF7EE` | Success badge background |
| `warning-600` | `#E3B341` | `#B8860B` | Near-due, pending review |
| `warning-soft` | `#221D0F` | `#FDF6E3` | Warning badge background |
| `error-600` | `#F0605A` | `#D32F2F` | Overdue, defaulted, rejected, destructive |
| `error-soft` | `#241213` | `#FDECEC` | Error badge background |
| `info-600` | `#5B9BF0` | `#2563EB` | Informational badges, neutral status |
| `info-soft` | `#101B29` | `#EAF1FD` | Info badge background |

### Loan / Member Status Colors

| Status | Background | Text | Dot |
|--------|-----------|------|-----|
| Paid | `success-soft` | `success-600` | `success-600` |
| Active | `info-soft` | `info-600` | `info-600` |
| Near Due (yellow) | `warning-soft` | `warning-600` | `warning-600` |
| Due Soon (orange) | `accent-soft` | `accent-500` | `accent-500` |
| Overdue (red) | `error-soft` | `error-600` | `error-600` |
| Defaulted (dark red) | `#1A0908` | `#C4453F` | `#C4453F` |
| Pending Approval | `warning-soft` | `warning-600` | `warning-600` |
| Rejected | `error-soft` | `error-600` | `error-600` |
| Member: Active | `success-soft` | `success-600` | `success-600` |
| Member: Suspended | `error-soft` | `error-600` | `error-600` |

**No gradients in app UI chrome.** The only acceptable gradient use:
- Marketing hero background (very subtle radial from `bg-surface` → `bg-canvas`)
- The "Elite Member" badge treatment (subtle warm cream-to-gold gradient, matching the reference)

---

## 4. Spacing

**8px base grid.** All spacing = multiple of 4.

| Token | Value | Usage |
|-------|-------|-------|
| `space-0.5` | 2px | Icon internal spacing |
| `space-1` | 4px | Tight gaps (badge padding) |
| `space-2` | 8px | Between related inline elements |
| `space-3` | 12px | Input internal padding, card gaps |
| `space-4` | 16px | Standard gap between components |
| `space-5` | 20px | Card internal padding (small cards) |
| `space-6` | 24px | Card internal padding (default) |
| `space-8` | 32px | Between sections within a page |
| `space-10` | 40px | Section separators |
| `space-12` | 48px | Large section breaks |
| `space-16` | 64px | Marketing section padding |
| `space-24` | 96px | Landing hero vertical padding |

**Page-level spacing:**
- Dashboard content max-width: `1400px` with `px-8` on desktop, `px-4` on mobile (financial tables need the extra width)
- Sidebar width: `260px` (expanded), `72px` (collapsed)
- Main content top padding: `24px` below header
- Section-to-section gap: `32px`
- Card internal padding: `24px` (default), `28px` (KPI/hero cards)

**Density: Comfortable** — table rows are `52px` tall. This is a professional back-office tool used for hours at a time; avoid cramped density.

---

## 5. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 8px | Inputs, small chips, tag pills |
| `radius` | 10px | **Default** — small cards, badges |
| `radius-md` | 14px | Medium cards, dropdown menus |
| `radius-lg` | 18px | Main dashboard cards, member profile card, table containers |
| `radius-xl` | 22px | Modal outer shell, hero KPI cards |
| `radius-full` | 9999px | Avatars, status dots, pill buttons, search bar |

**Rule**: Never mix radius values in the same container. A card with `radius-lg` should contain children with `radius` or smaller, never larger. Buttons are almost always fully rounded (`radius-full`) to match the reference's pill-button language.

---

## 6. Shadows & Elevation

```
shadow-xs:    0 1px 2px 0 rgba(0, 0, 0, 0.30)
shadow-sm:    0 2px 6px 0 rgba(0, 0, 0, 0.35)
shadow-md:    0 6px 16px -2px rgba(0, 0, 0, 0.40)
shadow-lg:    0 14px 30px -6px rgba(0, 0, 0, 0.45)
shadow-xl:    0 24px 48px -12px rgba(0, 0, 0, 0.55)

shadow-focus: 0 0 0 3px rgba(232, 150, 58, 0.25)  // Focus rings only (accent-based)
```

**Usage:**
- Cards on dark page: `border border-[--border-subtle]` + `shadow-xs` (shadows read faintly on dark backgrounds — borders do most of the separation work)
- Hover on interactive cards: `bg-card-hover` + `shadow-sm`
- Dropdowns & popovers: `shadow-md` + `border border-subtle`
- Modals: `shadow-xl`
- Focus rings: `shadow-focus` instead of outline
- **Inputs have NO shadow** — use border only

**Philosophy**: On dark backgrounds, borders carry hierarchy; shadows are a secondary cue for elevation, never the primary one.

---

## 7. Component Specifications

### 7.0 The Eight-State Contract

**Every interactive component spec below must define all eight states.** A spec that stops at hover and focus is incomplete — this matters even more here because misread interaction states on a financial approval action have real consequences.

| State | Requirement |
|---|---|
| `default` | Resting appearance — bg, border, text, radius |
| `hover` | Pointer affordance. Never the only affordance (touch devices have no hover) |
| `focus-visible` | `shadow-focus` ring, always visible, never removed without a replacement |
| `active` | Pressed feedback — `scale(0.98)` or a darker step, 100ms |
| `disabled` | `border-subtle` bg / `text-muted` text, `aria-disabled`, still legible |
| `loading` | Spinner replaces icon, label stays, element width does not change |
| `error` | `error-600` border + message text below (`13px`, `error-600`). Never colour alone |
| `success` | `success-600` border or check icon, clears after ~2s or on next edit |

`error` and `success` are non-negotiable on every form in the loan-approval flow — a maker-checker action must never be ambiguous about whether it succeeded.

---

### 7.1 Buttons

**Primary Button**
- Background: `text-primary` value inverted — i.e. white-on-black in dark mode (`bg-[#FAFAFA] text-[#0A0A0A]`), black-on-white in light mode (`bg-[#141414] text-white`) — matches the reference's black pill button
- Text: `14px` weight 500
- Height: `40px` (default), `36px` (sm), `44px` (lg)
- Horizontal padding: `20px`
- Border radius: `radius-full` (pill)
- Hover: 90% opacity
- Active: 90% opacity + scale(0.98)
- Focus: `shadow-focus` ring
- Disabled: `border-subtle` bg, `text-muted` text
- Loading: spinner replaces icon, text stays

**Secondary Button (Outline)**
- Background: transparent
- Border: `1px solid border-strong`
- Text: `text-primary`, 14px weight 500
- Radius: `radius-full`
- Hover: `bg-card-hover`

**Ghost Button**
- Background: Transparent
- Text: `text-secondary`, 14px weight 500
- Hover: `bg-card-hover`

**Destructive Button**
- Background: `error-600`
- Text: White
- Radius: `radius-full`
- Hover: darken 10%
- Use only for delete/reject/blacklist actions

**Text Link**
- Color: `accent-500`
- Hover: `accent-600`, underline
- Inline: underlined, `underline-offset-4`, `decoration-[--border-strong]`

**Icon Button**
- Size: `36×36px` (default), `32×32px` (sm)
- Background: Transparent (ghost) or `bg-card` + border
- Icon: `18px`, `text-secondary`
- Radius: `radius-full`
- Hover: `bg-card-hover`

---

### 7.2 Inputs

- Height: `42px`
- Background: `bg-input`
- Border: `1px solid border-subtle`
- Radius: `radius-sm` (8px)
- Padding: `14px` horizontal
- Text: `14px`, `text-primary`
- Placeholder: `text-muted`
- Focus: `accent-500` border + `shadow-focus` ring, **no outline**
- Disabled: `bg-card` bg, `text-muted` text
- Invalid: `error-600` border, error text below (`13px`, `error-600`)
- Label above: `13px` weight 500, `text-secondary`, `8px` gap to input
- Helper text below: `12px`, `text-secondary`

**Textarea**: same as input, min-height `100px`, `vertical` resize only.

**Select**: same as input + chevron icon right. On open, menu uses `shadow-md` + `border border-subtle` + `bg-card`.

**Global Search Input (pill style, matches reference)**
- Background: `bg-card`
- Border: `1px solid border-subtle`
- Radius: `radius-full`
- Icon: search, `text-muted`, left `14px`
- Height: `40px`
- Placeholder: "Search members, loans, payments"
- On focus: border → `accent-500`, subtle `shadow-focus`

---

### 7.3 Cards

**Default Card**
- Background: `bg-card`
- Border: `1px solid border-subtle`
- Radius: `radius-lg` (18px)
- Shadow: `shadow-xs`
- Padding: `24px`
- Hover (if interactive): `bg-card-hover` + `shadow-sm`

**KPI / Stat Card (dashboard metric)**
- Label: `caption` uppercase `text-secondary` tracking-wider
- Value: `stat-value` (32px weight 700), `text-primary`, `tabular-nums`, prefixed `UGX` where currency
- Delta: `13px` weight 500, `success-600` (up) or `error-600` (down), with a small arrow icon
- Icon: top-right, `20px`, `text-muted`
- Radius: `radius-xl`

**Member Profile Card (matches reference exactly)**
- Padding: `24px`
- Photo: circular, `96px`, centered
- Badge (e.g. "Elite Member"): pill, cream/gold gradient background, dark text, small star icons either side, positioned above the photo
- Name: `h3`, centered
- ID: `caption`, `text-secondary`, centered, tabular
- Background: soft warm off-white card even in dark mode (this single card intentionally breaks the dark palette to visually anchor the member — matches the reference's cream card treatment) OR `bg-card` with a thin gold border — choose the cream variant for the "Elite/Premium" member tier, standard `bg-card` for regular members

**Loan Type Card (Home/Car/Business style thumbnails)**
- Radius: `radius-lg`
- Image: full-bleed top, `radius-lg` on top corners only, `4:3` aspect ratio
- Padding below image: `16px`
- Title: `h4`, underlined on hover (matches reference's underlined loan names)
- Meta rows (ID, Rate, Start Date): `body-sm`, `text-secondary`, label left / value right or stacked

**Feature Card (landing)**
- Padding: `32px`
- Icon: `40px`, `accent-500` in an `accent-soft` square (`radius`)
- Title: `h3`
- Description: `body` `text-secondary`

---

### 7.4 Tables (Data Table component)

- Header row: `bg-surface`, `12px` weight 600 `text-secondary` uppercase tracking-wider, `44px` tall
- Body row: `52px` tall (comfortable), `14px` `text-primary`
- Border bottom between rows: `1px solid border-subtle`
- Hover row: `bg-card-hover`
- Selected row: `accent-soft` background
- First column padding: `20px` left
- Last column padding: `20px` right
- Sort indicators: `text-muted` chevron, `accent-500` when active
- Sticky header when scrolling
- Zebra striping: **off** — rely on dividers only
- Money columns: right-aligned, `tabular-nums`
- Status columns: use the Status Badge component (§7.5), never bare text or color-only cells

**Row actions (kebab menu)**: icon button on hover reveal, dropdown right-aligned, `bg-card` + `shadow-md`.

**Mobile (below `md`)**: rows convert to stacked cards, label:value pairs, one card per record.

---

### 7.5 Status Badges

- Height: `26px`
- Padding: `4px 12px`
- Radius: `radius-full`
- Font: `12px` weight 500
- Dot: `6px` circle, `6px` right margin, flex-inline
- Background + text: see §3 Loan / Member Status Colors

**Example** — Paid:
```
bg-[--success-soft] text-[--success-600]
● Paid
```

**Example** — Overdue:
```
bg-[--error-soft] text-[--error-600]
● Overdue · 12 days
```

---

### 7.6 Sidebar (Dashboard Navigation)

- Width: `260px`
- Background: `bg-surface`
- Border right: `1px solid border-subtle`
- Padding: `20px 16px`
- Logo block: "NextGen SACCO" wordmark + small "admin"/"member" pill badge next to it (matches reference's "Proloans [admin]" treatment), `64px` tall, bottom border `border-subtle`
- Nav section label: `micro` uppercase `text-muted`, `12px` bottom margin
- Nav item:
  - Height: `42px`
  - Padding: `10px 14px`
  - Radius: `radius`
  - Icon: `18px` `text-secondary`
  - Text: `14px` weight 500 `text-secondary`
  - Gap icon ↔ text: `12px`
  - Hover: `bg-card-hover`
  - **Active**: `text-primary` weight 600 + a small `accent-400` dot to the left of the label (exactly matching the reference's active-item dot — do NOT use a full background highlight, the dot alone signals active state)
- Branch selector (head office only): dropdown pinned below logo block
- User block at bottom: avatar `36×36` + name `14px` + role `12px text-secondary` + chevron for account menu
- "+ Add New" quick-action button pinned above user block, pill style, full sidebar width
- Version number: `micro`, `text-muted`, bottom of sidebar

---

### 7.7 Top Bar / Page Header

- Height: `68px`
- Background: `bg-surface`
- Border bottom: `1px solid border-subtle`
- Padding: `0 32px`
- Left: page title (`h1`) + breadcrumb trail (`body-sm`, `text-secondary`, `/` separators, matches reference: "All Accounts > Account ... > Beneficiary > Kiran Nair")
- Center/right: global search pill
- Right: notification bell with unread count badge (`error-600` circle), avatar + name + chevron
- Sticky on scroll

---

### 7.8 Modals & Dialogs

- Overlay: `rgba(0, 0, 0, 0.6)` + `backdrop-blur-sm`
- Modal: max-width `520px` (default), `680px` (lg), `840px` (approval-action modals with amortization preview)
- Background: `bg-card`
- Radius: `radius-xl` (22px)
- Shadow: `shadow-xl`
- Border: `1px solid border-subtle`
- Header padding: `24px 24px 16px`
- Body padding: `16px 24px`
- Footer padding: `16px 24px 24px`, right-aligned buttons with `12px` gap
- Title: `h3`
- Description: `body-sm` `text-secondary`
- Close button: icon top-right `16px`
- Open animation: scale(0.96) + opacity → scale(1) + opacity, `200ms` ease-out

---

### 7.9 Toasts / Notifications

Using Sonner:
- Bottom-right position
- `bg-card`, `shadow-lg`, `border border-subtle`
- Radius: `radius` (10px)
- Padding: `14px 16px`
- Icon left: `18px`, color by type
- Title: `14px` weight 500 `text-primary`
- Description: `13px` `text-secondary`
- Auto-dismiss: `4s`
- Success: checkmark `success-600`
- Error: x-circle `error-600`
- Warning: triangle `warning-600`
- Info: info-circle `accent-500`

---

### 7.10 Empty States

- Vertically centered in container
- Icon: `48px`, `text-muted` inside a `72×72` `bg-card-hover` circle
- Title: `h3` `text-primary`
- Description: `body` `text-secondary`, max-width `400px`, centered
- Primary CTA button below, `32px` top margin

---

### 7.11 Forms

- Field vertical gap: `20px`
- Field group label: `13px` weight 500 `text-secondary`
- Field group helper text: `12px` `text-secondary`, below input
- Section group divider: `border-t border-subtle`, `32px` top margin
- Section group header: `h4` `text-primary`, followed by `body-sm text-secondary`
- Form footer: sticky bottom or inline, right-aligned Cancel (ghost) + Save (primary)
- **Multi-step forms** (loan application, member registration): numbered step indicator at top, current step filled with `accent-500`, completed steps show a checkmark, future steps `text-muted`

**Validation (React Hook Form + Zod):**
- Inline errors below field: `12px` weight 500 `error-600`
- Border on invalid: `error-600`
- Disable submit button during `isSubmitting`, show spinner inside button

**Approval action forms (maker-checker):**
- Comments field is **required** on Reject and Return actions, optional on Approve
- A confirmation modal always precedes a final Approve/Reject/Disburse action — no silent one-click financial decisions

---

## 8. Iconography

Use **[Lucide Icons](https://lucide.dev)** (`lucide-react`) as the primary icon library.

**Sizing:**
- Nav icons: `18px`
- Inline with body text: `14px`
- Icon buttons: `18px`
- Card feature icons: `20–24px`
- Empty state icons: `48px`
- Marketing feature icons: `28–40px`

**Color rules:**
- Default neutral icons: `text-secondary`
- Active/selected icons: `accent-500`
- Icon inside a primary button: matches button text color (white or near-black depending on mode)
- Status icons: match the semantic color of the status they represent

**Stroke width:** `1.75` (slightly finer than default — reads as more refined/banking-grade on dark backgrounds). Do not mix strokes.

---

## 9. Motion & Animation

**Principles:** fast, subtle, never bouncy — this is a financial tool, not a consumer app.

| Transition | Duration | Easing |
|-----------|----------|--------|
| Button press | `100ms` | `ease-out` |
| Hover state | `150ms` | `ease-out` |
| Dropdown/popover | `150ms` | `ease-out` |
| Modal enter | `200ms` | `ease-out` |
| Modal exit | `150ms` | `ease-in` |
| Page transition | `250ms` | `ease-out` |
| Toast slide | `250ms` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Approval-stage progress step | `300ms` | `ease-out` |

**Do:**
- `transition-colors` on all interactive elements
- Fade + scale for modals (`scale(0.96) → scale(1)`)
- Skeleton shimmer for loading cards and KPI values (never show `UGX 0` while loading — show a skeleton)

**Don't:**
- Spring animations
- Rotation / flips
- Anything > 400ms
- Blinking, pulsing (except loading spinners) — especially never pulse a status badge to draw attention to overdue loans, that reads as alarming rather than informative

---

## 10. Imagery

- **Loan-type thumbnails** (member profile active loans): real or stock photography matching the loan purpose (home, vehicle, storefront), `4:3`, `radius-lg` top corners, subtle dark overlay gradient at bottom if text sits on the image
- **Avatars**: Circular, `bg-card-hover` placeholder bg with initials in `text-secondary`
- **Empty states**: Simple Lucide icon, no illustrations
- **Logos (brand)**: NextGen SACCO wordmark, max `160×48px` in PDF, `h-10` in email header, `h-8` in dashboard sidebar
- **Landing hero**: A single dashboard screenshot in a browser-style frame, subtle shadow, on the dark canvas background

---

## 11. Landing Page Specifics

- Hero background: `bg-canvas` (`#0A0A0A`) with a very subtle radial `bg-surface → transparent` centered
- Hero headline: `display` (44px) `text-primary`, max 2 lines
- Hero subhead: `body-lg` (16px) `text-secondary`, max 640px width
- Hero CTA cluster: primary pill button ("Staff Login") + ghost pill ("Member Portal") link, `24px` gap
- Section alternation: `bg-canvas` → `bg-surface` → `bg-canvas`, `96px` vertical padding each
- Max content width: `1200px`
- Feature grid: 3 columns desktop, 1 column mobile, `32px` gap
- No pricing section — this is an internal operational system, not a self-serve SaaS product

---

## 12. PDF Templates (Loan Agreements, Statements, Receipts)

PDFs use `@react-pdf/renderer` with its own `StyleSheet`. PDFs render on **white**, not dark — keep spacing rhythm and typography scale aligned with the dashboard, but adapt the palette for print/light legibility:

**PDF palette:**
- Text primary: `#141414`
- Text secondary: `#5C5C5C`
- Muted: `#9A9A9A`
- Borders: `#E7E5E1`
- Brand accent: `#C97A24` (accent-600, print-safe amber)

**PDF typography:**
- Header/total: 22px weight 700
- Section headings: 12px weight 700 uppercase, `letterSpacing: 0.5`
- Body: 10px weight 400
- Table: 10px, `tabular-nums`

**PDF spacing:**
- Page padding: `40px`
- Section gap: `24px`
- Header height: `80px` (SACCO logo + branch name + document title + generated date)

**Document set:** Loan Agreement (with signature block), Loan Statement / Amortization Schedule, Savings Statement / Passbook, Payment Receipt, Member Statement, Audit Report, all standard financial reports (trial balance, income statement, balance sheet). All share the typography scale, palette, and spacing rhythm above, and all include the SACCO logo, branch name, and generation timestamp in the header/footer.

---

## 13. Email Templates (React Email)

- Max width: `600px`
- Background: `#F4F4F3`
- Card: white, `border: 1px solid #E7E5E1`, `radius: 14px`
- Header: `#141414` background with the NextGen SACCO wordmark in white
- Body padding: `24px`
- Typography: system font stack (Inter renders in most modern email clients; include fallbacks) — `font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif`
- Buttons: solid `#141414`, white text, `12px 24px` padding, `radius: 999px` (pill, matches app), `font-size: 14px`, `weight: 500`
- Footer: `caption` size, `text-secondary` color, centered, includes branch contact info
- **Currency**: always `UGX`, never `$`
- **Notification types**: due-date reminder, approval/rejection, disbursement confirmation, late-payment/penalty alert, membership-expiry notice — each uses the same shell, with the semantic color (warning/error/success) applied only to a small status chip inside the email, never the full header

---

## 14. Tailwind Configuration (v4 — CSS-first)

Tailwind v4 uses a CSS-first configuration model. ALL custom tokens go in `globals.css` via the `@theme` directive. No `tailwind.config.ts` file is created or needed.

Add this to your `app/globals.css` inside an `@theme` block:

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", system-ui, sans-serif;

  --color-accent-400: #F5A94E;
  --color-accent-500: #E8963A;
  --color-accent-600: #C97A24;

  --color-success-600: #3FB950;
  --color-warning-600: #E3B341;
  --color-error-600: #F0605A;
  --color-info-600: #5B9BF0;

  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.30);
  --shadow-focus: 0 0 0 3px rgba(232, 150, 58, 0.25);

  --radius-sm: 0.5rem;
  --radius-md: 0.625rem;
  --radius-lg: 0.875rem;
  --radius-xl: 1.125rem;
}

/* Dark mode (default) and light mode custom variables — not expressible via @theme alone */
:root {
  --bg-canvas: #F7F7F5;
  --bg-surface: #FFFFFF;
  --bg-card: #FFFFFF;
  --bg-card-hover: #F4F4F3;
  --bg-input: #FFFFFF;
  --border-subtle: #E7E5E1;
  --border-strong: #D4D1CB;
  --text-primary: #141414;
  --text-secondary: #5C5C5C;
  --text-muted: #9A9A9A;
  --success-soft: #EAF7EE;
  --warning-soft: #FDF6E3;
  --error-soft: #FDECEC;
  --info-soft: #EAF1FD;
  --accent-soft: #FDF3E5;

  --font-mono: "JetBrains Mono", "Fira Code", monospace;
  --sidebar-width: 260px;
  --sidebar-collapsed-width: 72px;
  --topbar-height: 68px;
}

.dark {
  --bg-canvas: #0A0A0A;
  --bg-surface: #141414;
  --bg-card: #171717;
  --bg-card-hover: #1D1D1D;
  --bg-input: #1A1A1A;
  --border-subtle: #262626;
  --border-strong: #333333;
  --text-primary: #FAFAFA;
  --text-secondary: #A1A1A1;
  --text-muted: #6B6B6B;
  --success-soft: #122117;
  --warning-soft: #221D0F;
  --error-soft: #241213;
  --info-soft: #101B29;
  --accent-soft: #2A2013;
}
```

Reference the runtime tokens (`--bg-canvas`, `--text-primary`, etc.) via Tailwind arbitrary values, e.g. `bg-[--bg-card] text-[--text-primary] border-[--border-subtle]`, or wire them into `@theme inline` mappings if the project prefers utility classes like `bg-card`. **Dark mode is the default theme** — apply `.dark` on `<html>` by default and let the sidebar toggle remove it for light mode (inverse of the usual shadcn default).

**IMPORTANT:** Do NOT create a `tailwind.config.ts`. Tailwind v4 ignores it unless you explicitly import it. All configuration is CSS-first. If a shadcn/ui install script creates a `tailwind.config.ts`, delete it — the `@theme` block in `globals.css` replaces it.

---

## 15. Responsive Breakpoints

**Mobile-first — every layout starts as single-column.** SACCO field staff and Recovery Officers will use this on phones during member visits — mobile quality is not optional.

| Breakpoint | Width | Target |
|---|---|---|
| Default | 360px+ | Phones, small devices |
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets (sidebars collapse, 2-column grids) |
| `lg` | 1024px | Desktop (sidebar visible, 3-column grids) |
| `xl` | 1280px | Wide desktop |
| `2xl` | 1536px | Ultrawide — financial tables get extra columns |

**Page-level rules:**
- Dashboard padding: `px-4 md:px-8`, max-width `1400px`, centered with `mx-auto`
- Sidebar: hidden below `lg` → Sheet drawer. `lg:flex` + `w-[260px]` when visible.
- Data tables: on `md` and below, convert each row to a stacked card (label:value layout) — critical for Recovery Officers viewing defaulter lists on phones
- Marketing section padding: `py-16 sm:py-24 lg:py-32`
- Hero text: `text-3xl sm:text-4xl md:text-5xl` — fluid, never a single size
- Touch targets: minimum `44×44px` on mobile, `40×40px` on desktop — extra important for Cashiers entering repayments quickly at a branch counter
- Modals: go full-screen below `sm` (`fixed inset-0 m-0 rounded-none`), centered card above `sm`
- Grid layouts: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Tables: horizontal scroll wrapper below `md` (`overflow-x-auto`) OR card conversion — prefer card conversion for member/loan lists, horizontal scroll for the accounting/ledger views where columns must stay aligned

**Test every page at 375px before considering it done.**

**Layout-safety mechanics — the five rules that prevent 90% of mobile breakage:**

1. **`overflow-x: clip` on BOTH `html` and `body`** — not just one.
2. **No clickable text may wrap to two lines** in nav items or CTA buttons.
3. **Any grid track containing an image needs `minmax(0, 1fr)`, never bare `1fr`.**
4. **Display-size headings need `overflow-wrap: anywhere; min-width: 0`.**
5. **Section headers collapse to a single column on mobile.**

```css
/* globals.css */
html,
body {
  overflow-x: clip; /* both — one alone is not enough */
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)); /* NOT repeat(3, 1fr) */
  gap: 24px;
}

h1,
h2,
.display {
  overflow-wrap: anywhere;
  min-width: 0;
}
```

```tsx
{/* Section header — stacks below sm, splits above */}
<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <h2 className="text-2xl font-semibold">Loan Applications</h2>
  <Button>New Application</Button>
</div>
```

---

## 16. Accessibility

- Color contrast: `4.5:1` for body text, `3:1` for large text and UI components — verified against BOTH dark and light backgrounds, since amber-on-dark and amber-on-light have different contrast ratios
- Focus rings: visible on all interactive elements (`shadow-focus`), never removed
- Icons used alone: include `aria-label` or `sr-only` text
- Form fields: always have a `<label>` linked via `htmlFor`
- Status badges: don't rely on color alone — include text + dot (critical for loan status, where a colorblind Loan Officer must still be able to distinguish "Overdue" from "Paid")
- Semantic HTML: use `<button>` for actions, `<a>` for navigation
- Maker-checker actions (Approve/Reject/Disburse) must be reachable and completable via keyboard alone, with a confirmation step — never a single unconfirmed click for an irreversible financial action

## 17. Do's & Don'ts

**Do:**
- Use `tabular-nums` for all money, IDs, and dates
- Prefix every currency value with `UGX`
- Use borders as the primary separator on dark surfaces; shadows are secondary
- Reserve amber accent for active/selected states and brand touches only
- Use pill-shaped buttons and inputs to match the reference language
- Use Lucide icons consistently at standard sizes
- Reuse shadcn/ui components where possible and restyle via tokens
- Require a confirmation step before any approval, rejection, or disbursement action

**Don't:**
- Use emoji in UI chrome
- Use drop shadows heavier than `shadow-md` in-app
- Use gradients outside of the "Elite Member" badge / marketing hero
- Mix border radius within a single container
- Use bright/saturated colors outside the semantic and accent tokens
- Hardcode `$` — this system is UGX-only
- Use font weights above 600 in app chrome (700 reserved for `stat-value` figures)
- Rely on color alone to communicate loan or member status
- Allow a single unconfirmed click to approve, reject, or disburse a loan
