# Design System

## Direction

The interface should feel like a calm school administration desk in bright daylight: familiar, orderly, and reassuring while a student and parent make a consequential decision on a phone. Design serves the task. Trust comes from clear structure, readable numbers, explicit uncertainty, and predictable controls—not official-looking decoration.

The identity is “مسارك”. Its mark combines an open book with a destination pin: education plus a practical route forward. The compact hero uses custom editorial artwork, never stock imagery, while keeping the two primary tools visible near the top of the first screen.

## Color

The strategy is restrained: pure white and a near-neutral blue-gray background carry most of the UI, with teal reserved for primary actions and selection. Deep navy anchors the identity without impersonating a government portal. Gold appears only as a small trust accent.

```css
--bg: oklch(0.985 0.004 207);
--surface: oklch(1 0 0);
--surface-soft: oklch(0.964 0.012 202);
--ink: oklch(0.245 0.028 235);
--muted: oklch(0.465 0.025 226);
--line: oklch(0.895 0.012 220);
--primary: oklch(0.395 0.084 201);
--primary-hover: oklch(0.335 0.078 201);
--primary-soft: oklch(0.94 0.035 196);
--navy: oklch(0.31 0.068 237);
--gold: oklch(0.67 0.12 83);
--success: oklch(0.48 0.11 157);
--warning: oklch(0.52 0.12 64);
--danger: oklch(0.48 0.17 28);
```

Status never relies on color alone: every state has an Arabic label and, where useful, an icon.

## Typography

Cairo is the sole family for the interface. It provides a clear Arabic rhythm across headings, labels, controls, and dense result data. Headings use 700–800 weights with letter spacing no tighter than `-0.035em`; body and labels use 400–700. Numerals use tabular figures and an isolated LTR direction inside RTL content.

## Layout

- Content width: 1160px maximum, with 16px desktop and 9px mobile gutters.
- Primary forms use two columns above 640px and a single column below.
- The main tool is paired with a dark trust rail on desktop; the rail collapses on smaller screens so the task stays first.
- The hero stays compact (roughly 228px on mobile and 284px on desktop) with the student and university artwork integrated directly into the navy background.
- Public content pages use a maximum prose width of 72 characters.
- Responsive targets: 360, 390, 768, 1024, and 1440px.

## Components

### Tool switcher

Two equal tabs are always visible. The active tab uses the primary teal fill and white text. On mobile, labels remain visible and are not replaced by ambiguous icons.

### Forms

Controls are 48px high with an 8px radius, clear labels, optional hints, visible focus rings, and dynamic scale validation. Segmented controls use familiar pressed states. Primary buttons are 50px high and use the same vocabulary everywhere.

### Results

Result lookup uses a structured detail list rather than a decorative card grid. Prediction starts with compact summary metrics, followed by three highlighted options and a filterable complete list. Every prediction has a category, confidence level, difference, explanation, and disclaimer.

When a governorate is selected, results show “same governorate”, “indicative nearby region”, or “other governorate”. A two-way control switches between nearby options and all governorates. Copy explicitly distinguishes this convenience ordering from official geographic-distribution rules.

### Loading and errors

Content-shaped skeletons communicate loading. Errors use concise recovery copy, a semantic alert role, and a tinted surface without heavy shadow. Empty states explain what the student can try next.

## Motion

Most interactions use 180ms color and state transitions. No orchestrated page entrance exists. Reduced-motion preferences collapse transitions and skeleton movement to near-instant changes.

## Accessibility

- Arabic RTL at document level.
- WCAG 2.2 AA contrast targets.
- Visible three-pixel focus ring.
- Keyboard-accessible tabs, segmented buttons, fields, filters, and actions.
- Minimum primary target height of 48px.
- Error and loading updates announced through live regions.
- Personal result routes and responses are `noindex, nofollow`.
