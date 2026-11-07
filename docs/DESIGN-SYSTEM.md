# Limus design system

Extracted from the purchased Lumis Framer template (`neat-attributes-527967.framer.app`) and implemented as CSS tokens in `src/app/globals.css` and components in `src/components/ui`.

## Typography
- **Geist** for everything (weights 400 and 500). Headings use weight 500 with tight tracking:
  - Display 3.5rem / 1.05 / −0.04em
  - H1 2.8rem / 1.05 / −0.04em
  - H2 2rem / 1.1 / −0.04em
  - H3 1.5rem / 1.3 / −0.04em
  - H4 1.25rem / 1.3 / −0.035em
- Body 14–16px, line height 1.4–1.5, letter-spacing −0.01em. Labels and meta text 12–13px.
- **Manrope 600** for primary buttons (14px, −0.015em), as in the template.
- Geist Mono is loaded for code and tabular use. Numbers use `tabular-nums`.

## Colour
| Token | Light | Dark | Use |
|---|---|---|---|
| ink | #000000 | #ffffff | headings, values |
| ink-3 | #3d3d3d | #d4d4d4 | strong body text |
| body | #616161 | #a3a3a3 | paragraphs |
| muted | #7a7a7a | #8a8a8a | labels |
| faint | #adadad | #5c5c5c | placeholders |
| bg / subtle / muted-bg | #fff / #f9fafb / #f3f4f6 | #0a0a0a / #101010 / #191919 | surfaces |
| line / line-strong | #e5e7eb / #d1d5db | #242424 / #333333 | borders, input rings |
| primary | #124eeb | #2b62f0 | buttons, links, active |
| primary-soft | #dae2f7 | #14224a | selected chips, badges |
| primary-light | #80b9ff | #80b9ff | accents on dark |
| navy | #0c2442 | | avatar, dark bands |
| profit / loss / warn | #12b33f / #e5484d / #c27c0e | #2bc45a / #f06468 / #e0a43a | P&L, status |

The chart categorical palette was validated for colour-vision deficiency with the dataviz validator: #124eeb, #eb6834, #1baf7a, #eda100, #e87ba4 (dark-mode steps in `globals.css`).

## Shape, spacing, elevation
- Radius: 6px (small), 8px (buttons, inputs), 12px (cards), 16px (hero panels).
- Spacing scale: 4, 6, 8, 12, 16, 24, 32, 48, 64 and 128px (the template's gaps). Page gutters are 16px on mobile, 24px on tablet and 32px on desktop. Content width is capped at 1400px.
- Cards: 1px #e5e7eb ring plus `0 1px 4px rgba(24,32,60,.06)`. Buttons use the template's three-layer soft shadow. Popovers use a deeper three-layer shadow.

## Components
Button (primary, secondary, dark, ghost, danger, link), IconButton, Input (with prefix and suffix), Select, Textarea, Field (label, hint, error), Toggle, Checkbox, Segmented (the template's 1D/7D/1M filter), ChipGroup, TagInput, Card and CardHeader, StatCard (icon chip, label, value, delta), Badge (neutral, primary, profit, loss, warn), Tabs, Menu, Modal, ConfirmDialog, Toast, Notice, EmptyState, Skeleton, PageHeader, and charts (EquityChart, DrawdownChart, PnlBars, RingChart, BreakdownBars, Heatmap).

## Logo
The pixel-sparkle mark is the template's own: a 7×7 grid of 4.143px cells fading from the centre (opacities 1, 0.6, 0.32, 0.07) in #124eeb. It is paired with the Geist 500 wordmark "Limus" at −0.04em.
