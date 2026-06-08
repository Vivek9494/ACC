---
name: Solar Minimalism
colors:
  surface: '#f9f9fc'
  surface-dim: '#dadadc'
  surface-bright: '#f9f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f6'
  surface-container: '#eeeef0'
  surface-container-high: '#e8e8ea'
  surface-container-highest: '#e2e2e5'
  on-surface: '#1a1c1e'
  on-surface-variant: '#5a4136'
  inverse-surface: '#2f3133'
  inverse-on-surface: '#f0f0f3'
  outline: '#8e7164'
  outline-variant: '#e2bfb0'
  surface-tint: '#a04100'
  primary: '#a04100'
  on-primary: '#ffffff'
  primary-container: '#ff6b00'
  on-primary-container: '#572000'
  inverse-primary: '#ffb693'
  secondary: '#705d00'
  on-secondary: '#ffffff'
  secondary-container: '#fdd400'
  on-secondary-container: '#6f5c00'
  tertiary: '#0062a1'
  on-tertiary: '#ffffff'
  tertiary-container: '#059eff'
  on-tertiary-container: '#003357'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb693'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7a3000'
  secondary-fixed: '#ffe170'
  secondary-fixed-dim: '#e9c400'
  on-secondary-fixed: '#221b00'
  on-secondary-fixed-variant: '#544600'
  tertiary-fixed: '#d0e4ff'
  tertiary-fixed-dim: '#9ccaff'
  on-tertiary-fixed: '#001d35'
  on-tertiary-fixed-variant: '#00497b'
  background: '#f9f9fc'
  on-background: '#1a1c1e'
  surface-variant: '#e2e2e5'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: auto
  max-width: 1280px
---

## Brand & Style

This design system is built upon a foundation of **Modern Minimalism** infused with a high-energy, optimistic spirit. The aesthetic targets high-growth startups and consumer-facing platforms that require a balance of professional clarity and vibrant personality. 

The visual narrative relies on expansive whitespace, a refined neutral backdrop, and intentional bursts of warmth. By utilizing the "Solar" palette (orange and yellow) against a crisp, cool-toned background, the UI directs focus toward action and progress. The emotional response is one of clarity, warmth, and modern efficiency.

## Colors

The color strategy uses a specific off-white, `#F4F4F8`, as the global canvas to reduce eye strain and provide a sophisticated alternative to pure white. 

- **Primary (Orange):** Reserved for high-priority calls to action, active states, and critical paths.
- **Secondary (Yellow):** Used for supportive actions, highlighting, and secondary interactive elements. It should be paired with dark text to ensure accessibility.
- **Neutral:** A deep slate used for typography to maintain high legibility without the harshness of pure black.
- **Surface:** Pure white is used sparingly for cards and containers to create a subtle "lifted" effect against the global background.

## Typography

This design system utilizes **Plus Jakarta Sans** for all typographic layers. Its soft, rounded terminals and modern geometric construction reinforce the friendly and optimistic brand personality.

Headlines use heavy weights and slight negative letter-spacing to create a distinctive, editorial impact. Body text remains generous in line-height to ensure maximum readability against the `#F4F4F8` background. For mobile environments, large display type scales down aggressively to maintain hierarchy within the viewport.

## Layout & Spacing

The layout is governed by a **fixed-width central grid** for desktop and a **fluid grid** for mobile. We use an 8px base unit to ensure all components and spacing increments are mathematically harmonious.

- **Desktop:** 12-column grid with a 1280px max-width. Gutters are fixed at 24px to provide ample breathing room between content blocks.
- **Mobile:** 4-column fluid grid with 16px outer margins. 
- **Rhythm:** Vertical rhythm should follow the 8px scale. Component internal padding should prioritize `md` (24px) for containers and `sm` (12px) for smaller elements like chips or list items.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Ambient Shadows**. Instead of heavy shadows, this design system uses soft, diffused shadows with a subtle tint of the primary color to suggest depth without adding visual clutter.

- **Level 0 (Background):** `#F4F4F8`.
- **Level 1 (Cards/Containers):** Pure `#FFFFFF` with a 1px border of `#E2E2E9`.
- **Level 2 (Interactive/Floating):** Pure `#FFFFFF` with a soft shadow: `0px 4px 20px rgba(255, 107, 0, 0.08)`.
- **Overlays:** Semi-transparent backdrops using a 20px blur (glassmorphism) to maintain the sense of a unified spatial environment.

## Shapes

The shape language is **Rounded**, utilizing a 0.5rem (8px) base radius for standard components like buttons and input fields. This radius strikes a balance between professional structure and approachable softness.

- **Standard (8px):** Buttons, Inputs, Chips.
- **Large (16px):** Cards, Modals, Featured Sections.
- **Extra Large (24px):** Hero elements or unique containers.
- **Pill:** Reserved exclusively for tags and status indicators to differentiate them from actionable buttons.

## Components

### Buttons
- **Primary:** Background `#FF6B00`, Text `#FFFFFF`. High-contrast, bold weight.
- **Secondary:** Background `#FFD600`, Text `#1A1C1E`. Used for alternative paths.
- **Tertiary:** Ghost style, using the primary color for text and a subtle background fill on hover.

### Cards
Cards must always be white (`#FFFFFF`) to pop against the background. They feature an 8px corner radius and a 1px subtle border. No heavy shadows unless the card is being dragged or hovered.

### Input Fields
Inputs use a white background with a 1px border of `#D1D1DB`. On focus, the border transitions to the primary Orange with a 2px outer glow. Labels are positioned above the field in `label-md` style.

### Chips & Lists
- **Chips:** Small, pill-shaped elements with light-grey backgrounds or secondary Yellow fills for "active" filtering.
- **Lists:** Clean, borderless rows separated by 1px dividers. Icons within lists should use a consistent 24px bounding box and the primary color for emphasis.

### Feedback Elements
Checkboxes and Radio buttons use the primary Orange for the selected state. Toggle switches utilize the secondary Yellow for the "on" position to provide a warm, tactile feel.