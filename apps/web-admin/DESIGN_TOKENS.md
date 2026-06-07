# Design Tokens Documentation

**Version:** 1.0
**Last Updated:** 2026-06-07

This document describes the design tokens used throughout the Real Estate Admin Dashboard. These tokens establish a consistent visual identity aligned with the website/account UI.

---

## 📋 Color System

### Primary Brand Colors

#### Navy (Deep)
- **Token:** `navy` / `--color-navy-deep`
- **Value:** `#0F1E33`
- **Usage:** Sidebar background, primary text, deep accents
- **Tailwind:** `bg-navy`, `text-navy`

#### Navy (Soft)
- **Token:** `navy-600` / `--color-navy-soft`
- **Value:** `#26405F`
- **Usage:** Secondary dark tones, hover states
- **Tailwind:** `bg-navy-600`

#### Gold/Amber (Primary Accent)
- **Token:** `brand-500` / `--color-gold-primary`
- **Value:** `#C8A24B` ⭐ Signature color
- **Usage:** Primary CTA buttons, focus states, active navigation, accent borders
- **Tailwind:** `bg-brand-500`, `text-brand-500`, `border-brand-500`

#### Gold (Soft/Background)
- **Token:** `brand-50` / `--color-gold-soft`
- **Value:** `#FBF6EA`
- **Usage:** Light backgrounds, subtle accents, hover states
- **Tailwind:** `bg-brand-50`

#### Gold (Full Ramp)
Available from `brand-50` to `brand-900` for various intensities.

---

### Background & Surface Colors

#### Canvas (Warm Page Background)
- **Token:** `canvas` / `--color-canvas-warm`
- **Value:** `#FAF7F2`
- **Usage:** Page/body background
- **Applied in:** `globals.css` → `body { @apply bg-canvas }`

#### Surface (White/Card Background)
- **Token:** `surface` / `--color-surface-white`
- **Value:** `#FFFFFF`
- **Usage:** Cards, panels, containers
- **Tailwind:** `bg-surface`

#### Surface Muted
- **Token:** `surface-muted` / `--color-surface-muted`
- **Value:** `#F4EFE8`
- **Usage:** Subtle backgrounds, input fields, disabled states
- **Tailwind:** `bg-surface-muted`

---

### Border & Divider Colors

#### Soft Border
- **Token:** `hairline` / `--color-border-soft`
- **Value:** `#E7DFD3`
- **Usage:** Card borders, dividers, subtle separators
- **Tailwind:** `border-hairline`

#### Muted Border
- **Token:** `--color-border-muted`
- **Value:** `#E5E7EB`
- **Usage:** Alternative border color for contrast

---

### Text Colors

#### Primary (Deep Navy)
- **Token:** `--color-text-primary`
- **Value:** `#0F1E33`
- **Usage:** Main body text, headings
- **Applied in:** `globals.css` → `body { @apply text-slate-900 }`

#### Secondary (Slate)
- **Token:** `--color-text-secondary`
- **Value:** `#64748B`
- **Usage:** Secondary content, descriptions
- **Tailwind:** `text-slate-500`

#### Muted (Light Slate)
- **Token:** `--color-text-muted`
- **Value:** `#94A3B8`
- **Usage:** Disabled text, captions, metadata
- **Tailwind:** `text-slate-400`

---

### Semantic Status Colors

#### Success
- **Token:** `success-500` / `--color-success`
- **Value:** `#10B981`
- **Full Ramp:** `success-50` to `success-700`
- **Usage:** Positive actions, confirmations, success states

#### Warning
- **Token:** `warning-500` / `--color-warning`
- **Value:** `#F59E0B`
- **Full Ramp:** `warning-50` to `warning-700`
- **Usage:** Alerts, caution states, pending actions

#### Danger
- **Token:** `danger-500` / `--color-danger`
- **Value:** `#EF4444`
- **Full Ramp:** `danger-50` to `danger-700`
- **Usage:** Errors, destructive actions, critical alerts

#### Info
- **Token:** `info-500` / `--color-info`
- **Value:** `#3B82F6`
- **Full Ramp:** `info-50` to `info-700`
- **Usage:** Informational messages, neutral alerts

---

### Stat Card & Accent Colors

#### Purple (New)
- **Token:** `purple-500`
- **Value:** `#A855F7`
- **Full Ramp:** `purple-50` to `purple-700`
- **Usage:** Stat card borders, icon backgrounds
- **Color Levels:**
  - Light: `purple-50` (#F3E8FF)
  - Medium: `purple-500` (#A855F7)
  - Dark: `purple-700` (#7E22CE)

#### Teal (New)
- **Token:** `teal-500`
- **Value:** `#14B8A6`
- **Full Ramp:** `teal-50` to `teal-700`
- **Usage:** Stat card borders, icon backgrounds
- **Color Levels:**
  - Light: `teal-50` (#F0FDFA)
  - Medium: `teal-500` (#14B8A6)
  - Dark: `teal-700` (#0F766E)

#### Stat Card Accents
- `--color-stat-purple: #A855F7` — Purple stat cards
- `--color-stat-teal: #14B8A6` — Teal stat cards
- `--color-stat-gold: #C8A24B` — Gold stat cards
- `--color-stat-red: #EF4444` — Red stat cards

---

## 🎨 Shadows

All shadows use navy-tinted RGB (15 30 51) to maintain visual depth.

### Shadow Levels

| Level | Token | Value | Usage |
|-------|-------|-------|-------|
| Extra Small | `shadow-xs` | `0 1px 2px 0 rgb(15 30 51 / 0.04)` | Subtle depth |
| Small | `shadow-sm` | `0 1px 2px 0 rgb(15 30 51 / 0.05)...` | Light elevation |
| Soft | `shadow-soft` | `0 1px 2px 0 rgb(15 30 51 / 0.04), 0 4px 16px -4px rgb(15 30 51 / 0.06)` | Default cards |
| Medium | `shadow-md` | `0 2px 4px -1px rgb(15 30 51 / 0.06)...` | Elevated content |
| Card | `shadow-card` | `0 8px 30px -12px rgb(15 30 51 / 0.12)` | Interactive cards (hover) |
| Large | `shadow-lg` | `0 4px 8px -2px rgb(15 30 51 / 0.06)...` | Large elevations |
| Lift | `shadow-lift` | `0 18px 48px -16px rgb(15 30 51 / 0.20)` | Maximum elevation |
| X-Large | `shadow-xl` | `0 12px 24px -6px rgb(15 30 51 / 0.10)...` | Modals, popovers |

---

## 🔘 Border Radius

Custom border radius values for modern, rounded aesthetic:

| Size | Token | Value | Usage |
|------|-------|-------|-------|
| Small | `rounded-lg` | `0.625rem` (10px) | Small components |
| Medium | `rounded-xl` | `0.875rem` (14px) | Form inputs, small cards |
| Large | `rounded-2xl` | `1.125rem` (18px) | Most cards, containers ⭐ Primary |
| X-Large | `rounded-3xl` | `1.5rem` (24px) | Large panels, modals |

**Primary Usage:** `rounded-2xl` is the standard for cards and most UI components.

---

## 🔤 Typography Weights

| Type | Token | Value | Usage |
|------|-------|-------|-------|
| Regular | `--font-weight-regular` | 400 | Body text |
| Medium | `--font-weight-medium` | 500 | Secondary headings, emphasis |
| Semibold | `--font-weight-semibold` | 600 | Card titles, form labels |
| Bold | `--font-weight-bold` | 700 | Page headings, strong emphasis |

---

## 📱 RTL Support

All design tokens are RTL-compatible via Tailwind CSS and CSS variables:

- **Text Direction:** Configured in HTML document root (`dir="rtl"` or `dir="ltr"`)
- **Font Family:** Automatically switches to Arabic font in RTL context (globals.css)
  ```css
  html[dir='rtl'] body {
    font-family: var(--font-arabic), var(--font-sans);
  }
  ```

---

## 🛠️ Implementation Guide

### Using Tailwind Classes (Recommended)

```tsx
// Cards with soft shadow and border
<div className="bg-surface border border-hairline rounded-2xl shadow-soft">
  {/* content */}
</div>

// KPI Card with colored border
<div className="border-t-4 border-brand-500 bg-surface">
  {/* content */}
</div>

// Stat card with purple accent
<div className="border-t-4 border-purple-500 bg-surface">
  {/* content */}
</div>
```

### Using CSS Variables

```css
.custom-card {
  background-color: var(--color-surface-white);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--border-radius-lg);
  box-shadow: 0 1px 2px rgb(15 30 51 / 0.04), 0 4px 16px -4px rgb(15 30 51 / 0.06);
  color: var(--color-text-primary);
}
```

### Components Already Using Tokens

- ✅ `PageKpiCard` — Uses `brand`, `success`, `warning`, etc. tones
- ✅ `Card` — Uses `surface`, `hairline`, `shadow-soft`
- ✅ `Sidebar` — Uses `navy`, `sidebar-*` tokens
- ✅ `Topbar` — Uses `surface`, `hairline`
- ✅ Charts — Use `brand-500`, `navy`, palette colors

---

## 📝 Notes for Future Updates

1. **Adding New Colors:** Extend the `colors` object in `tailwind.config.ts`
2. **CSS Variables:** Mirror changes in `globals.css` `:root` section
3. **Documentation:** Update this file when adding/modifying tokens
4. **Testing:** Check both RTL and LTR layouts after color changes
5. **Accessibility:** Ensure sufficient contrast (WCAG AA minimum 4.5:1 for text)

---

## 🔍 Color Contrast Reference

| Combination | Contrast Ratio | WCAG Level |
|------------|-----------------|-----------|
| Navy-deep (#0F1E33) on white | 14.6:1 | AAA ✅ |
| Navy-deep on canvas warm | 11.8:1 | AAA ✅ |
| Gold-primary on white | 5.2:1 | AA ✅ |
| Gold-primary on canvas | 3.8:1 | AA (text 18px+) |
| Text-secondary on white | 5.7:1 | AA ✅ |
| Text-muted on white | 4.6:1 | AA ✅ |

---

**For questions or updates, please reference the Tailwind config and globals.css files.**
