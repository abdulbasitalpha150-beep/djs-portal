# Frontend Color Palette Implementation Prompt

Paste the section below into your AI coding tool (Claude Code, Cursor, etc.) or hand it to your dev.

---

## PROMPT TO USE

> **Task: Update frontend color system only — no backend or logic changes.**
>
> I want to restyle my SaaS app's frontend with a new color palette. This is a **visual/styling change only**. Do NOT touch:
>
> - API routes, controllers, or server logic
> - Database models/queries
> - State management logic (Redux/Zustand/Context logic itself — only class names/styles may change)
> - Component logic, props, or data flow
> - Business logic of any kind
>
> Only modify:
>
> - CSS/SCSS variables, Tailwind config, theme files, design tokens
> - Class names/styling attributes on components (not their logic)
> - Any hardcoded hex colors in components → replace with the new tokens below
>
> **Implement this color system as CSS custom properties (and Tailwind config if Tailwind is used):**
>
> ```css
> :root {
>   /* Primary — Plum */
>   --plum-50: #f7eff3;
>   --plum-100: #eedce5;
>   --plum-200: #dbb7cb;
>   --plum-300: #c48fad;
>   --plum-400: #a8688c;
>   --plum-500: #6b3654; /* base / primary brand color */
>   --plum-600: #5a2c46;
>   --plum-700: #482338;
>   --plum-800: #36192a;
>   --plum-900: #24101c;
>
>   /* Secondary — Navy */
>   --navy-50: #edf0f5;
>   --navy-100: #d2dae8;
>   --navy-200: #a6b6d1;
>   --navy-300: #7891ba;
>   --navy-400: #4a6da3;
>   --navy-500: #1b2a4a; /* base / secondary — headers, nav, footer */
>   --navy-600: #16223c;
>   --navy-700: #101a2d;
>   --navy-800: #0b121f;
>   --navy-900: #060a10;
>
>   /* Neutral warm light — Oatmeal (backgrounds, cards) */
>   --oatmeal-50: #fdfcf9;
>   --oatmeal-100: #faf7f0;
>   --oatmeal-200: #f3ede0;
>   --oatmeal-300: #eae0cb;
>   --oatmeal-400: #dfd0b0;
>   --oatmeal-500: #d2be93; /* base */
>   --oatmeal-600: #b49f72;
>   --oatmeal-700: #8f7d58;
>   --oatmeal-800: #695a40;
>   --oatmeal-900: #443a2a;
>
>   /* Neutral warm mid — Beige (borders, secondary surfaces) */
>   --beige-50: #faf7f2;
>   --beige-100: #f3ece1;
>   --beige-200: #e8dcc8;
>   --beige-300: #dbcab0;
>   --beige-400: #cbb496;
>   --beige-500: #b99c7a; /* base */
>   --beige-600: #9c7f5f;
>   --beige-700: #7d6449;
>   --beige-800: #5e4b36;
>   --beige-900: #3f3224;
>
>   /* Accent — Terracotta (CTAs, highlights only — used sparingly) */
>   --accent-50: #fdf0ea;
>   --accent-100: #fad9c9;
>   --accent-200: #f2b091;
>   --accent-300: #e88a5d;
>   --accent-400: #d96a3b;
>   --accent-500: #c05627; /* base — primary button color */
>   --accent-600: #9e4520;
>   --accent-700: #7a3519;
>   --accent-800: #572611;
>   --accent-900: #33160a;
>
>   /* Semantic */
>   --color-success: #5b7b5a;
>   --color-warning: #c08a3e;
>   --color-error: #a8433a;
>   --color-info: #4a6da3;
>
>   /* Functional mappings */
>   --color-bg-primary: var(--oatmeal-50);
>   --color-bg-secondary: var(--beige-100);
>   --color-surface-card: #ffffff;
>   --color-border: var(--beige-300);
>   --color-text-primary: var(--navy-800);
>   --color-text-secondary: var(--navy-500);
>   --color-text-muted: var(--beige-700);
>   --color-cta: var(--accent-500);
>   --color-cta-hover: var(--accent-600);
>   --color-link: var(--plum-500);
>   --color-link-hover: var(--plum-600);
> }
> ```
>
> **Usage rules:**
>
> - Navy → headers, nav bars, footers, primary headings, dark-mode surfaces
> - Plum → links, secondary buttons, active states, icons, badges
> - Oatmeal → main page background (light, airy feel)
> - Beige → card borders, dividers, muted backgrounds, secondary surfaces
> - Terracotta accent → primary CTA buttons ONLY (used sparingly, max 1-2 per screen so it stays impactful)
> - Maintain WCAG AA contrast: use `--navy-800` or `--navy-900` for body text on light backgrounds, never plum/beige text on beige/oatmeal backgrounds
>
> **Steps:**
>
> 1. Find all hardcoded hex/RGB color values in CSS, SCSS, Tailwind config, or styled-components
> 2. Replace them with the token variables above based on their function (background, text, border, button, etc.)
> 3. If using Tailwind, extend `theme.colors` in `tailwind.config.js` with these palettes instead of using arbitrary values
> 4. Do not rename existing CSS classes/component props unless purely cosmetic — preserve all existing className hooks used by JS logic
> 5. Test both light backgrounds (oatmeal/beige) and dark backgrounds (navy) for text contrast
> 6. Leave all animations, layout, spacing, and component structure untouched — colors only

---

## Why the accent color was added

Plum, navy, oatmeal, and beige are all mid-to-low saturation and close in value — great for a calm, premium feel, but a "Sign Up" button in plain plum on oatmeal can undersell itself. The terracotta accent (`#C05627`) sits opposite this palette on the color wheel, so it's the only color reserved for conversions: primary buttons, "new" badges, upgrade prompts. Everything else stays quiet so the accent actually draws the eye.

## Alternative palette (if you want options)

If you're open to it, a slightly higher-contrast variant of the same mood:

- **Deep Plum** `#5C2A47` → richer, more saturated primary
- **Ink Navy** `#141E33` → near-black navy for stronger text/header contrast
- **Linen** `#F6F1E7` → lighter oatmeal replacement, better background neutrality
- **Sand** `#D8C4A0` → slightly warmer beige, better card contrast
- **Accent: Ochre Gold** `#C99A3B` → instead of terracotta, if you want a more "premium/finance" feel vs. "warm/friendly" feel

Happy to generate this as a live Tailwind config file or a visual swatch preview if useful.
