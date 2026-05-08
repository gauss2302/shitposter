# Shitposter — Design System

> One palette. One typography pair. One density scale per surface class. No emoji as icons. Light AND dark, tokenized end to end.
>
> Source of truth for visual decisions. Codified `2026-05-09` from a from-source design audit. If a surface deviates from this document, either the surface is wrong or this document is — pick one and fix it.

---

## 0. Voice and tone (recap)

- Marketing voice can be **dare**, **ironic**, **loud**. The word "shitpost" is an anchor, not a punchline.
- Product voice is **calm**, **professional**, **direct**. Empty states warm, errors specific, microcopy in active voice.
- Both voices share one visual language. The surface tells you which mode you're in (loud type, large hero, decorative motion) without changing the brand.

---

## 1. Brand mark and logo lockup

- **Single mark** — replaces the photo-thumbnail-as-logo currently used in the marketing header AND the lavender "S" square used everywhere else. Pick one and use it everywhere.
- **Lockup**: `[mark] shitpost.art` — mark first, wordmark second, 8px gap, both vertically centered, mark height = wordmark cap-height × 1.4.
- **Wordmark** uses Geist Sans Medium (500), tracking `-0.01em`.
- **Photo "hero_main_sm.png"** is a marketing asset only (hero image, OG image), never a logo.

---

## 2. Color tokens

The system has **one** primary accent. Both the previous lavender pastel line and the dashboard blue gradient line are retired. Surfaces, borders, and text are warm-neutral. The accent is saturated coral-orange (`#FF5A1F`) — a stance, not a hedge.

### 2.1 Light mode (default)

| Token | Hex | Use |
|---|---|---|
| `--color-paper` | `#FAFAF7` | Body / page background — warm off-white |
| `--color-surface-1` | `#F4F4EE` | Subtle raised surface, secondary panels |
| `--color-surface-2` | `#FFFFFF` | Cards, modals, primary panels |
| `--color-ink` | `#0F0F12` | Body text, primary headings, ink CTAs |
| `--color-muted` | `#5C5A53` | Secondary text, descriptions |
| `--color-faint` | `#8E8C84` | Tertiary text, captions, timestamps |
| `--color-border-subtle` | `#E8E6DF` | Card borders, dividers, low-emphasis lines |
| `--color-border` | `#D1CFC7` | Default border for inputs, separators |
| `--color-border-strong` | `#0F0F12` | Ink borders for high-emphasis CTAs |
| `--color-primary` | `#FF5A1F` | Brand accent — CTAs, brand hits, focus rings |
| `--color-primary-hover` | `#E64A0F` | Primary hover state |
| `--color-primary-tint` | `#FFEEE6` | Tinted surfaces (hero halos, hover bg) |
| `--color-primary-on` | `#FFFFFF` | Foreground when on `--color-primary` |
| `--color-success` | `#0F8A4F` | Success states, posted indicators |
| `--color-warning` | `#B7791F` | Warning states, scheduled-soon |
| `--color-danger` | `#C53030` | Errors, destructive actions, failed posts |

### 2.2 Dark mode

| Token | Hex |
|---|---|
| `--color-paper` | `#0A0A0C` |
| `--color-surface-1` | `#161618` |
| `--color-surface-2` | `#1F1F22` |
| `--color-ink` | `#E5E5DD` |
| `--color-muted` | `#A0A097` |
| `--color-faint` | `#6B6A63` |
| `--color-border-subtle` | `#26262A` |
| `--color-border` | `#34343A` |
| `--color-border-strong` | `#E5E5DD` |
| `--color-primary` | `#FF7A45` |
| `--color-primary-hover` | `#FF8F60` |
| `--color-primary-tint` | `#3A1A0E` |
| `--color-primary-on` | `#0A0A0C` |
| `--color-success` | `#34D399` |
| `--color-warning` | `#FBBF24` |
| `--color-danger` | `#F87171` |

### 2.3 Rules

- **Never reach for raw hex in components.** All colors go through the token system. ESLint rule (future): warn on `bg-[#`/`text-[#`/`border-[#` arbitrary colors.
- **Never color-encode meaning alone.** Success/warning/danger always pair with an icon or label.
- **Selection color** uses `--color-primary` background with `--color-primary-on` foreground.
- **Focus ring** uses `--color-primary` at 100% opacity, 2px offset, `focus-visible:` only — never style `:focus`.
- **Platform brand colors** (Instagram pink, X black, etc.) are allowed *only* on the platform-icon glyph itself, never on chrome or text.
- **No gradients on buttons** by default. Gradients are reserved for marketing hero only, and use the `--color-primary` → `--color-primary-hover` ramp, not arbitrary 4-stop blues.

---

## 3. Typography

### 3.1 Family

- **Display + Body**: **Geist Sans** (one family, no second face). Loaded via `next/font/google` for SSR-safe FOUT-free rendering.
- **Mono**: **Geist Mono** for API keys, code, tabular data when stylistic.
- **No system font fallbacks as a primary stack.** Geist is loaded `display: 'swap'` with a tuned `--app-font-fallback` adjusted via `adjustFontFallback`.

### 3.2 Scale

Major-third (1.25) modular scale, anchored at 16px body.

| Token | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `display-2xl` | `clamp(3.5rem, 6vw, 6rem)` (56–96px) | 1.0 | 600 | Marketing hero only |
| `display-xl` | `3rem` (48px) | 1.05 | 600 | Section H2s on marketing |
| `display-lg` | `2.25rem` (36px) | 1.1 | 600 | Page titles in product |
| `h1` | `1.875rem` (30px) | 1.2 | 600 | Card / module headings |
| `h2` | `1.5rem` (24px) | 1.25 | 600 | Subsection headings |
| `h3` | `1.25rem` (20px) | 1.3 | 600 | Component headings |
| `body-lg` | `1.125rem` (18px) | 1.55 | 400 | Marketing body |
| `body` | `1rem` (16px) | 1.5 | 400 | Default body |
| `body-sm` | `0.875rem` (14px) | 1.5 | 400 | Dense product UI |
| `caption` | `0.75rem` (12px) | 1.4 | 500 | Captions, timestamps |
| `overline` | `0.6875rem` (11px) | 1.2 | 600, `0.08em` track | Small caps labels (e.g. "Authenticated") |

### 3.3 Rules

- **`font-black` (900) is gone.** It maxes at `600` (semibold) for headings, `700` (bold) only on specific brand display moments (hero word in marketing). Stat numerals use `500` (medium) with `tabular-nums`.
- **`text-wrap: balance`** on every multi-line heading. **`text-pretty`** on body paragraphs over 60 chars.
- **Measure**: 60–75 ch on body paragraphs. Use `max-w-prose` or explicit `max-w-[60ch]`.
- **Tabular numerals** (`font-variant-numeric: tabular-nums`) on stat cards, prices, post counts, table cells with numbers.
- **Curly quotes**, real ellipsis (`…`), real em-dash (`—`). Never `"..."`, never `--`.
- **`letter-spacing`**: heading tighter (`-0.02em` on display, `-0.01em` on h1-h3), body neutral (`0`), overline wider (`0.08em`).

---

## 4. Spacing, radius, shadow

### 4.1 Spacing scale

4px base. Use `gap`, `padding`, `margin` only on the scale: `1 (4) / 2 (8) / 3 (12) / 4 (16) / 5 (20) / 6 (24) / 8 (32) / 10 (40) / 12 (48) / 16 (64) / 20 (80) / 24 (96)`.

### 4.2 Density classes

| Class | Padding scale | Used on |
|---|---|---|
| **Dense** | 8/12px | Tables, posts list rows, dashboard stat cards |
| **Default** | 16/24px | Forms, settings sections |
| **Comfortable** | 32/48px | Marketing surfaces, empty states |

The current code mixes dense and comfortable on the same page (data-heavy posts list reading like marketing). Pages **commit to one density** per surface and stick with it.

### 4.3 Radius

A real hierarchy, not "everything bubbly".

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | `6px` | Inputs, small buttons, chips |
| `--radius-md` | `10px` | Buttons, cards, list rows |
| `--radius-lg` | `14px` | Modals, large cards, panels |
| `--radius-xl` | `20px` | Hero modules, marketing cards |
| `--radius-pill` | `9999px` | Status pills, avatar containers, segmented controls |

`rounded-2xl/3xl/4xl` are retired except where mapped to one of the above.

### 4.4 Shadows

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgb(15 15 18 / 0.04)` | Cards, list rows |
| `--shadow-md` | `0 2px 6px rgb(15 15 18 / 0.06), 0 1px 2px rgb(15 15 18 / 0.04)` | Hovered cards, popovers |
| `--shadow-lg` | `0 12px 32px rgb(15 15 18 / 0.08), 0 4px 8px rgb(15 15 18 / 0.04)` | Modals, dropdowns |
| `--shadow-focus` | `0 0 0 3px rgb(255 90 31 / 0.35)` | Focus rings |

**Colored shadows are gone.** No `shadow-[#C5BAFF]/30`, no `shadow-[0_30px_70px_rgba(64,98,255,0.35)]`. Shadow is depth, not decoration. The single decorative exception is the marketing hero, which may use `--shadow-lg` with `--color-primary-tint` blur on the hero image frame.

---

## 5. Motion

- **Durations**: `90ms` (micro), `180ms` (default), `360ms` (page-level), `560ms` (hero entrance). No `transition: all`.
- **Easing**: `cubic-bezier(0.2, 0, 0, 1)` (entering, hero), `cubic-bezier(0.4, 0, 1, 1)` (exiting), `cubic-bezier(0.4, 0, 0.2, 1)` (default).
- **`prefers-reduced-motion: reduce`** disables all decorative animation. The `float-up` background animation is decorative and reduces to `display: none` for those users.
- **Marketing hero** gets motion: 2-3 intentional moves (entrance fade-up on H1, slow gradient shimmer on the accent word, parallax on hero image on scroll). All defined as real keyframes in `globals.css` — no dead `animate-blob` class names.
- **Product UI** is mostly motionless. Allowed: hover lifts (1px translate), tab indicator slides, modal in/out (180ms scale + fade), toast slide-in. Forbidden in product: floating particles, bouncy springs on data, decorative gradient shimmer.

---

## 6. Iconography

- **Platform marks** (Instagram, TikTok, LinkedIn, X/Twitter, YouTube, Threads) use **monochrome SVG** glyphs from the [Simple Icons](https://simpleicons.org) library. All inline as `<svg>` components, sized to the type cap-height of the line they sit on. No emoji.
- **UI icons** (chevrons, settings, send, calendar) use [Lucide](https://lucide.dev) — single stroke weight (1.5px), 20×20 default size.
- **No emoji as design elements anywhere in product UI.** Acceptable: user-generated content (post body), reactions where they're part of the data.
- The "S" lavender square mark is retired; the photo `hero_main_sm.png` is retired as a logo (it stays as a hero image only).

---

## 7. Component patterns

### 7.1 Buttons

| Variant | Background | Foreground | Border |
|---|---|---|---|
| `primary` | `--color-primary` | `--color-primary-on` | none |
| `ink` | `--color-ink` | `--color-paper` | none |
| `outline` | transparent | `--color-ink` | `--color-border` (1px) |
| `ghost` | transparent | `--color-ink` | none, hover bg `--color-surface-1` |
| `danger` | `--color-danger` | white | none |

- All buttons share: `radius-md`, `body-sm` weight `500`, padding `10px 16px` (default), `8px 12px` (small), `14px 24px` (large).
- Hover: bg shifts to `*-hover` token; no translate-y on default product buttons.
- Marketing hero CTAs may use `radius-lg` and `body-lg` and a 1px hover lift.
- **Focus**: `--shadow-focus` ring, no outline.
- **Loading**: button keeps width, swaps label for spinner + truncated text (e.g. "Saving…").

### 7.2 Cards

- **Surface**: `--color-surface-2` on `--color-paper` background.
- **Border**: `--color-border-subtle`, 1px.
- **Radius**: `--radius-lg`.
- **Padding**: `24px` default (Comfortable), `16px` (Default), `12px` (Dense).
- **Shadow**: `--shadow-sm` resting, `--shadow-md` on hover *only if interactive* (clickable card).
- **Cards earn their existence.** A row of 3 cards is justified only if each card represents an independent task or object the user might act on. Otherwise it's a list, not a card grid. The current 3-feature landing grid is being replaced with a cardless layout.

### 7.3 Form inputs

- `radius-sm`, `--color-border` 1px, `--color-surface-2` bg, `body` size, `12px` vertical padding.
- **Label outside** the input, never as placeholder-as-label.
- **Focus**: `--color-primary` border + `--shadow-focus`.
- **Error**: `--color-danger` border, error text below the input (not in tooltip).
- **Helper text** below the input in `caption` size, `--color-muted`.

### 7.4 Empty states

Every empty state has:
- One visual (illustration or icon, not emoji)
- Headline (one line, declarative — "No accounts connected", not "Welcome!")
- One sentence of context explaining what they do here
- One primary action that gets them out of the empty state

### 7.5 Tables (posts, accounts, analytics rows)

- **Dense density**, `body-sm`, `tabular-nums` on numeric columns.
- Row hover: `--color-surface-1` bg, no shadow.
- Selected row: `--color-primary-tint` bg, `--color-primary` left-border (3px).
- Sortable column headers with chevron in `--color-faint`.

---

## 8. Layout

- **Container**: `max-w-7xl` (1280px) for marketing, `max-w-screen-xl` (1280px) for product.
- **Page padding**: 16px mobile, 24px tablet, 32px+ desktop.
- **Breakpoints**: `sm: 640`, `md: 768`, `lg: 1024`, `xl: 1280`, `2xl: 1536`.
- **Heading on marketing**: `text-wrap: balance`, max two lines.
- **Section rhythm on marketing**: deliberate variety, not equal-height blocks. Hero (tall), narrative section (asymmetric two-column), pricing (compact), footer.
- **No carousels** unless they have a narrative purpose (e.g. step-by-step walkthrough).

---

## 9. Accessibility floor

- **Body text contrast**: minimum 4.5:1 against its surface. `--color-ink` on `--color-paper` = ~17:1. `--color-muted` on `--color-paper` = ~5.4:1. `--color-faint` on `--color-paper` ≈ 3.7:1 — restricted to captions ≥ 12px and small icons only, never body.
- **Touch targets**: 44×44 minimum on interactive elements.
- **Focus rings**: visible everywhere. `:focus-visible` only.
- **`prefers-reduced-motion`**: respected.
- **No color-only encoding.** Status pips pair color + label or color + icon.
- **Visited links** keep the visited indicator on long-form content. Product chrome (sidebar nav) opts out.

---

## 10. Dark mode

- Triggered by `prefers-color-scheme: dark`. Class-based override (`<html class="dark">`) reserved for a future explicit toggle; tokens already support it.
- Every token has a dark variant. Components reference tokens only. New code should not have `dark:` Tailwind variants — the token system handles it. Existing `dark:` variants will be migrated out incrementally.
- Hero gradients in dark mode use desaturated primary (`--color-primary` already shifts from `#FF5A1F` to `#FF7A45`).
- Photo and illustration assets that bake light backgrounds need a dark variant or a `mix-blend-mode` treatment — tracked per-asset.

---

## 11. Marketing vs product surface map

| Surface | Density | Type scale | Allowed motion | Decorative gradients |
|---|---|---|---|---|
| Landing (`/`) | Comfortable | display-2xl, display-xl | Hero only (3 moves) | Hero word + hero halo |
| Sign in / Sign up | Default | display-lg, h1 | Single page-load fade | Hero halo only on right column |
| Dashboard home | Default → Dense | display-lg, h1, h2 | Hover, tab transitions | None |
| Posts (list, compose) | Dense | h2, body-sm | Tab transitions, modal in/out | None |
| Accounts (list, billing) | Default | h1, h2 | Modal, toast | None |
| Analytics | Dense | h1, body-sm | Chart hover only | None |
| AI / Developer | Default | h1, h2 | None | None |

---

## 12. What changed (audit deltas)

This document was authored as part of the 2026-05-09 design audit. Specific deviations from the previous (untokenized) state:

- Two parallel palettes (lavender marketing + blue dashboard) → one tokenized system, fresh primary.
- System font stack → Geist Sans.
- `font-black` everywhere → max `600` on headings, `700` on hero word.
- Emoji as platform icons → monochrome SVG (Simple Icons).
- 3 decorative blurred blobs in landing hero → at most one purposeful primary-tint halo behind the hero image.
- 3-column AI-slop feature grid → cardless or asymmetric narrative section.
- `rounded-2xl/3xl/4xl` everywhere → `radius-md` for buttons/cards, `radius-lg` for modals, `radius-pill` for chips.
- Colored shadows (`shadow-[#C5BAFF]`) → neutral `--shadow-*` tokens.
- Dead animation classes (`animate-blob`, `animate-fade-in-up`, `animate-gradient`) → either real keyframes in `globals.css` or removed.
- Half-broken dark mode → fully tokenized dark variant.

---

*This document is the contract. PRs that violate tokens get reverted with a reference to the section they broke.*
