# CRM / SaaS Dual-Theme Color System — Implementation Prompt

Paste the section below into your AI coding tool or hand to your dev. Built for a data-dense freight-broker CRM (dashboards, tables, status pills, sidebar nav).

---

## PROMPT TO USE

> **Task: Add a dual-theme (dark default, light optional) color system to the frontend only — no backend or logic changes.**
>
> Do NOT touch:
>
> - API routes, controllers, database models/queries
> - Component logic, state management logic, data fetching, routing
> - Existing className hooks used by JS/tests — only their _styles_, not structure
>
> Only modify:
>
> - CSS variables / design tokens, Tailwind config, theme provider
> - A theme toggle (dark default, persisted in localStorage, respects `prefers-color-scheme` only as fallback if no saved preference)
> - Hardcoded hex colors in components → replace with tokens below
>
> **Implement as CSS custom properties, switched via `[data-theme="dark"]` / `[data-theme="light"]` on `<html>`, dark = default:**
>
> ```css
> /* ===== Base color ramps (shared across themes) ===== */
> :root {
>   /* Primary — Indigo (brand, primary buttons, active nav, links) */
>   --indigo-50: #eef1ff;
>   --indigo-100: #dfe3ff;
>   --indigo-200: #b9c1ff;
>   --indigo-300: #8d97ff;
>   --indigo-400: #6a72f5;
>   --indigo-500: #4f51e0; /* base */
>   --indigo-600: #3e3fc2;
>   --indigo-700: #31329b;
>   --indigo-800: #262773;
>   --indigo-900: #1a1b4f;
>
>   /* Slate — neutrals (backgrounds, borders, text) */
>   --slate-25: #f8f9fb;
>   --slate-50: #f1f3f6;
>   --slate-100: #e4e7ec;
>   --slate-200: #cbd1db;
>   --slate-300: #9aa4b2;
>   --slate-400: #6b7686;
>   --slate-500: #4a5568;
>   --slate-600: #364152;
>   --slate-700: #27303f;
>   --slate-800: #1b2330;
>   --slate-850: #141a24;
>   --slate-900: #0d1219;
>   --slate-950: #080b10;
>
>   /* Accent — Teal (success, delivered, paid, positive metrics) */
>   --teal-400: #3fc6ae;
>   --teal-500: #24a88f;
>   --teal-600: #1b8570;
>
>   /* Warning — Amber (pending, backlog, needs attention) */
>   --amber-400: #f0b152;
>   --amber-500: #db9530;
>   --amber-600: #b5771f;
>
>   /* Danger — Red (missing docs, errors, overdue) */
>   --red-400: #ef6b62;
>   --red-500: #dc4c42;
>   --red-600: #b93a32;
>
>   /* Info — Sky (secondary informational) */
>   --sky-400: #5eb3e8;
>   --sky-500: #3b93d1;
> }
>
> /* ===== DARK THEME (default) ===== */
> [data-theme="dark"] {
>   --color-bg-app: var(--slate-950);
>   --color-bg-sidebar: var(--slate-900);
>   --color-bg-surface: var(--slate-850); /* cards, panels */
>   --color-bg-surface-2: var(--slate-800); /* nested cards, table row hover */
>   --color-border: var(--slate-700);
>   --color-border-subtle: var(--slate-800);
>
>   --color-text-primary: #f4f6f9;
>   --color-text-secondary: var(--slate-300);
>   --color-text-muted: var(--slate-400);
>
>   --color-brand: var(--indigo-400);
>   --color-brand-hover: var(--indigo-300);
>   --color-cta-bg: var(--indigo-500);
>   --color-cta-bg-hover: var(--indigo-400);
>   --color-cta-text: #ffffff;
>
>   --color-success: var(--teal-400);
>   --color-warning: var(--amber-400);
>   --color-danger: var(--red-400);
>   --color-info: var(--sky-400);
>
>   --color-nav-active-bg: var(--indigo-900);
>   --color-nav-active-text: var(--indigo-300);
>   --color-nav-text: var(--slate-300);
>   --color-nav-text-hover: #ffffff;
> }
>
> /* ===== LIGHT THEME ===== */
> [data-theme="light"] {
>   --color-bg-app: var(--slate-25);
>   --color-bg-sidebar: #ffffff;
>   --color-bg-surface: #ffffff;
>   --color-bg-surface-2: var(--slate-50);
>   --color-border: var(--slate-200);
>   --color-border-subtle: var(--slate-100);
>
>   --color-text-primary: var(--slate-900);
>   --color-text-secondary: var(--slate-600);
>   --color-text-muted: var(--slate-400);
>
>   --color-brand: var(--indigo-600);
>   --color-brand-hover: var(--indigo-700);
>   --color-cta-bg: var(--indigo-500);
>   --color-cta-bg-hover: var(--indigo-600);
>   --color-cta-text: #ffffff;
>
>   --color-success: var(--teal-600);
>   --color-warning: var(--amber-600);
>   --color-danger: var(--red-600);
>   --color-info: var(--sky-500);
>
>   --color-nav-active-bg: var(--indigo-50);
>   --color-nav-active-text: var(--indigo-600);
>   --color-nav-text: var(--slate-600);
>   --color-nav-text-hover: var(--slate-900);
> }
> ```
>
> **CRM-specific usage mapping (matches the dashboard structure provided):**
>
> - Sidebar (`Operate`, `Records`, `Admin` sections) → `--color-bg-sidebar`, active item → `--color-nav-active-bg` / `--color-nav-active-text`
> - KPI cards (Active leads, Pending quotes, Active loads) → `--color-bg-surface` with `--color-border`
> - "Pending approvals · Backlog" style sub-labels → `--color-warning` on muted badge background
> - "Commission pending · Locked until paid" → `--color-warning` or `--color-text-muted` depending on emphasis
> - "Missing docs · Needs data source" → `--color-danger` accent on the number, muted label text
> - Delivered / Paid metrics → `--color-success`
> - Charts (Gross margin per week, Agent performance) → line/bar in `--color-brand`, gridlines in `--color-border-subtle`
> - "Open →" links in approval list rows → `--color-brand`, hover `--color-brand-hover`
> - Row hover in tables (Leads, Customers, Loads, etc.) → `--color-bg-surface-2`
> - Primary buttons ("New Lead", "New Quote" etc.) → `--color-cta-bg` / `--color-cta-bg-hover`
>
> **Theme toggle requirements:**
>
> - Default theme = dark on first load
> - Toggle switch in top nav (near "Viewing as Admin") to switch dark/light
> - Persist choice in `localStorage` (`theme` key), read on app load before first paint to avoid flash
> - All existing components must consume the CSS variables above — do not leave any hardcoded `#fff`, `#000`, or gray hex values in component files
>
> **Performance requirement — external CSS only:**
>
> - All styles must live in external `.css` (or `.scss`) files, loaded via `<link>` or bundler import — never inline `style="..."` attributes and never `<style>` blocks embedded in HTML/JSX/templates
> - If any component currently uses inline styles or embedded `<style>` tags for colors, move that CSS into the appropriate external stylesheet (component-level `.css`/`.module.css` file, or the global theme file for tokens) and reference it via className instead
> - This applies to the color tokens above as well as any other inline styling found during the audit — inline/internal CSS forces the browser to recalculate styles per-element and blocks proper caching, minification, and reuse across pages, so it should be eliminated wherever found
> - Framework-specific note: if using React/Vue with CSS-in-JS (styled-components, emotion, etc.), that's acceptable since it still compiles to external stylesheets at build time — the rule is about avoiding `style={{}}` inline props and raw `<style>` tags, not banning a specific tooling approach
>
> **Steps:**
>
> 1. Add the token blocks above to the global stylesheet or Tailwind `theme.extend.colors`
> 2. Set `data-theme="dark"` on `<html>` by default; implement toggle + localStorage persistence
> 3. Audit all components for hardcoded colors AND inline/internal CSS — replace hardcoded colors with the semantic tokens (`--color-bg-surface`, `--color-text-primary`, etc.) and move any inline/embedded styles into external stylesheets — never reference raw ramp values (`--indigo-500`) directly in components
> 4. Verify WCAG AA contrast in both themes, especially small text (badges, table cell text) on `--color-bg-surface-2`
> 5. Leave all layout, spacing, component structure, and data logic untouched — this is a color/theme and CSS-organization change only

---

## Why this palette for a freight-broker CRM

- **Indigo** as primary reads as modern SaaS without being generic blue — still feels neutral enough for a B2B operations tool
- **Slate** neutrals (not pure gray) have a slight cool undertone that pairs well with indigo and holds up in both dark and light mode without looking muddy
- **Teal** for success/delivered/paid is distinct from indigo so it doesn't compete with brand color or links, and reads clearly as "good"
- **Amber** for pending/backlog and **red** for missing docs/overdue give your approvals and status pills clear at-a-glance urgency — important given how much of this dashboard is queue/status driven (Pending approvals, Missing docs, Commission pending, etc.)
- Dark-first fits ops/dispatch-style tools well (long dashboard sessions, less eye strain), while the light theme stays fully defined for anyone who prefers it

Happy to turn this into an actual `tailwind.config.js` + theme-provider React snippet, or mock up the dashboard visually so you can see it before implementing.
