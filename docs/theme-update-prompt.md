# Prompt — Applying the new styles.css to the rest of the app

Paste this into your AI coding tool alongside the new `styles.css` file.

---

> **Task: Replace the current global CSS file with the new `styles.css` (petrol/copper/graphite palette). This is a frontend styling change only — no backend, API, or business logic changes.**
>
> **1. Replace the file**
> Overwrite the existing global stylesheet (wherever `@theme inline` / `:root` tokens currently live — likely `src/styles/globals.css` or `src/app/globals.css`) with the new `styles.css` content exactly as provided. All CSS custom property _names_ (`--primary`, `--background`, `--sidebar`, `--chart-1`, etc.) are unchanged — only their values changed — so no Tailwind class names or component code should need to change.
>
> **2. Confirm dark is default**
>
> - On initial page load, `<html>` should have `class="dark"` (or `data-theme="dark"`) applied by default, before first paint, to avoid a flash of the wrong theme.
> - If there's a theme provider (e.g. `next-themes`, a custom `ThemeContext`, or similar) find it and set its `defaultTheme` to `"dark"` and `enableSystem` to `false` (unless you want OS preference to override on first visit only — if so, fall back to dark when there is no OS preference detected, not to light).
> - If no theme provider exists yet, one needs to be added: store the choice in `localStorage`, read it in a blocking inline script or root layout before render, and toggle the `dark` class / `data-theme` attribute on `<html>`.
>
> **3. Add or verify the theme toggle**
> There should be a toggle control (sun/moon icon or switch) in the top nav, likely near "Viewing as Admin" in the current layout. If one already exists, just confirm it toggles between `dark` and `data-theme="light"` correctly. If it doesn't exist, add one that:
>
> - Reads current theme from `localStorage` on mount
> - Toggles the `dark` class / `data-theme` attribute on click
> - Persists the new value to `localStorage`
>
> **4. Audit for hardcoded colors**
> Search the codebase for hex codes, `rgb()`, or Tailwind color utilities that reference the old palette or raw colors instead of tokens — for example:
>
> - `text-indigo-*`, `bg-slate-*`, `border-slate-*` (old palette classes, if Tailwind color utilities were used directly instead of the CSS variables)
> - Any inline `#RRGGBB` or `rgb()` values in `.tsx`/`.jsx`/`.vue` files
> - Any inline `style={{ color: ... }}` or `style="..."` attributes
>
> Replace all of these with the semantic classes/tokens from `styles.css` (e.g. `bg-card`, `text-muted-foreground`, `bg-sidebar-accent`, `text-destructive`, or the raw var equivalents `var(--color-brand)`, `var(--color-success)`, etc.) so every color in the app routes through the theme system and switches correctly with the toggle.
>
> **5. Keep all CSS external — no inline or internal styles**
> As with the earlier instruction: no `<style>` blocks in HTML/JSX, no inline `style="..."` attributes for colors. CSS-in-JS that compiles to external stylesheets (styled-components, emotion, Tailwind/vanilla-extract) is fine. If the audit in step 4 finds inline color styles, move them into the appropriate stylesheet/module and reference via className instead of removing them in place.
>
> **6. Do not touch**
>
> - Component logic, data fetching, routing, state management
> - Layout, spacing, typography scale, breakpoints
> - Any non-color CSS (grid patterns, animations, radius values) — these are preserved as-is in the new file and should not be altered further
>
> **7. Sanity check after applying**
>
> - Load the dashboard in dark mode (default) — sidebar should be near-black graphite with petrol-teal active nav item, copper CTA buttons should stand out
> - Toggle to light mode — sidebar should go white/near-white, text should stay high-contrast, copper CTA should remain visually consistent
> - Check status pills / badges (Pending approvals, Missing docs, Delivered) pick up moss/gold/brick/steel correctly in both themes
> - Check chart colors (Gross margin, Agent performance) aren't all the same hue — they should cycle through brand → copper → success → warning → info

---

## What changed vs. the previous version

| Role          | Before                 | Now                                                             |
| ------------- | ---------------------- | --------------------------------------------------------------- |
| Primary/brand | Indigo                 | **Petrol** (deep teal)                                          |
| CTA/accent    | Indigo (same as brand) | **Copper** (distinct from brand, used only for CTAs/highlights) |
| Neutrals      | Slate (cool blue-gray) | **Graphite** (warm charcoal)                                    |
| Success       | Teal                   | **Moss** (avoids clashing with new teal-based brand color)      |
| Warning       | Amber                  | **Gold** (slightly warmer, ties into copper family)             |
| Danger        | Red                    | **Brick** (warmer red, less "stock alert red")                  |
| Info          | Sky blue               | **Steel**                                                       |

The old indigo/slate combo is close to the default shadcn/ui and Tailwind UI starter theme, which is why it read as generic. Petrol + copper + graphite keeps the same "professional dark SaaS" structure but gives DJ's Freight Broker a palette that isn't shared with half the dashboards built this year — and copper as a standalone accent color (rather than reusing the brand color for CTAs, as before) gives buttons more visual pop.
