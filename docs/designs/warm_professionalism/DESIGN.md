---
name: Warm Professionalism
colors:
  surface: '#fff8f5'
  surface-dim: '#e2d8d3'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fcf1ec'
  surface-container: '#f7ece6'
  surface-container-high: '#f1e6e1'
  surface-container-highest: '#ebe0db'
  on-surface: '#1f1b18'
  on-surface-variant: '#5a4136'
  inverse-surface: '#352f2c'
  inverse-on-surface: '#f9efe9'
  outline: '#8e7164'
  outline-variant: '#e2bfb0'
  surface-tint: '#a04100'
  primary: '#a04100'
  on-primary: '#ffffff'
  primary-container: '#ff6b00'
  on-primary-container: '#572000'
  inverse-primary: '#ffb693'
  secondary: '#765b00'
  on-secondary: '#ffffff'
  secondary-container: '#ffc703'
  on-secondary-container: '#6e5400'
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
  secondary-fixed: '#ffdf94'
  secondary-fixed-dim: '#f5bf00'
  on-secondary-fixed: '#251a00'
  on-secondary-fixed-variant: '#594400'
  tertiary-fixed: '#d0e4ff'
  tertiary-fixed-dim: '#9ccaff'
  on-tertiary-fixed: '#001d35'
  on-tertiary-fixed-variant: '#00497b'
  background: '#fff8f5'
  on-background: '#1f1b18'
  surface-variant: '#ebe0db'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  max-width: 1280px
---

## Brand & Style
The brand personality is welcoming, dependable, and energetic. It targets a professional audience that values clarity and warmth over sterile corporate aesthetics. The UI evokes a sense of optimistic productivity through a "Modern Organic" style—blending the structure of functional SaaS with a warm, tactile color palette. 

The design emphasizes high legibility and soft surfaces, avoiding the coldness of pure whites and greys in favor of a cream-based foundation that reduces eye strain while maintaining a high-end, editorial feel.

## Colors
This design system utilizes a warm, high-contrast light mode. The foundation is built on a soft cream surface (`#FFF8F2`) to provide a sophisticated alternative to standard white. 

- **Primary Orange (#FF6B00):** Used for primary actions, active states, and critical brand moments.
- **Secondary Yellow (#FFC700):** Used for highlights, warnings, and supporting accents.
- **Neutral:** A deep charcoal-sepia is used for text to maintain warmth while ensuring AAA accessibility against the cream background. 
- **Borders:** Use a subtle mid-tone version of the neutral palette to define boundaries without breaking the soft aesthetic.

## Typography
The typography system balances modern precision with technical clarity. **Hanken Grotesk** provides a sharp, contemporary look for headings, while **Inter** ensures maximum readability for long-form content and UI controls. **JetBrains Mono** is utilized for labels, metadata, and micro-copy to inject a sense of technical competence and structured data. All text must utilize the deep charcoal-sepia neutral to ensure high contrast against the cream background.

## Layout & Spacing
The design system employs a 12-column fluid grid for desktop and a 4-column grid for mobile. Spacing follows a strict 8px linear scale. 

- **Desktop:** 64px outside margins with 24px gutters. Content is centered with a max-width of 1280px.
- **Mobile:** 16px outside margins with 16px gutters.
- **Vertical Spacing:** Use consistent increments (16px, 32px, 64px) to define section hierarchy. Internal component padding should be generous to maintain a breathable, "Minimalist" feel.

## Elevation & Depth
Depth is created through **Tonal Layers** and **Ambient Shadows**. Because the background is cream (`#FFF8F2`), shadows should not be pure black; instead, use a deep warm-grey tint with low opacity (10-15%) to maintain a natural appearance.

- **Level 0 (Base):** The cream surface background.
- **Level 1 (Cards/Containers):** Pure white surfaces with a thin 1px border (`#E5DED8`) or a very soft, diffused shadow.
- **Level 2 (Dropdowns/Modals):** Pure white surfaces with a more pronounced, multi-layered shadow to signify interaction priority.

## Shapes
A "Rounded" shape language is applied to balance the sharp typography. UI elements like buttons and input fields use a 0.5rem (8px) base radius. Large containers like cards and modals use 1rem (16px) or 1.5rem (24px) to emphasize the soft, approachable nature of the brand.

## Components
- **Buttons:** Primary buttons use the Orange (`#FF6B00`) with white text. Secondary buttons use a white background with an orange border and text. High-emphasis hover states should involve a slight darkening of the orange.
- **Input Fields:** Use a white background to contrast against the cream surface. Borders should be 1px solid (`#D1C9C2`), turning Orange on focus. Labels use the JetBrains Mono label-sm style.
- **Cards:** Elevate cards with a white background and a subtle shadow or a 1px border. Do not use shadows and borders simultaneously unless for a specific active state.
- **Chips:** Small, pill-shaped indicators using the Secondary Yellow (`#FFC700`) with dark text for high visibility or a light neutral tint for low-priority tags.
- **Lists:** Use subtle dividers (1px, #E5DED8) and generous vertical padding (16px) to ensure items remain distinct and legible.