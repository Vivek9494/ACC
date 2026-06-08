---
name: Solar Minimalism
colors:
  surface: '#fbf8ff'
  surface-dim: '#dad9e3'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f2fd'
  surface-container: '#eeedf7'
  surface-container-high: '#e8e7f1'
  surface-container-highest: '#e3e1ec'
  on-surface: '#1a1b22'
  on-surface-variant: '#5a4136'
  inverse-surface: '#2f3038'
  inverse-on-surface: '#f1effa'
  outline: '#8e7164'
  outline-variant: '#e2bfb0'
  surface-tint: '#a04100'
  primary: '#a04100'
  on-primary: '#ffffff'
  primary-container: '#ff6b00'
  on-primary-container: '#572000'
  inverse-primary: '#ffb693'
  secondary: '#5f5e59'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfd9'
  on-secondary-container: '#63635d'
  tertiary: '#5f5e5e'
  on-tertiary: '#ffffff'
  tertiary-container: '#9a9898'
  on-tertiary-container: '#313131'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb693'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7a3000'
  secondary-fixed: '#e5e2dc'
  secondary-fixed-dim: '#c9c6c0'
  on-secondary-fixed: '#1c1c18'
  on-secondary-fixed-variant: '#474742'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c8c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474746'
  background: '#fbf8ff'
  on-background: '#1a1b22'
  surface-variant: '#e3e1ec'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
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
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max-width: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

This design system embodies a "Solar Minimalism" aesthetic—a fusion of high-clarity functionalism and radiant, optimistic energy. The brand personality is professional yet warm, designed to evoke a sense of clarity, innovation, and approachability. It is tailored for modern tech audiences who value both precision and human-centric design.

The visual style leverages **Minimalism** for its core structure, utilizing generous white space and a restricted color palette to reduce cognitive load. This is layered with **Glassmorphism** to create depth and a sense of "lightness." The interface should feel like it is composed of suspended, translucent planes of glass catching the warmth of a setting sun.

## Colors

The palette is anchored by a vibrant, high-energy orange (`#ff6b00`), used strategically for calls to action and critical brand moments. To maintain the "Solar" theme, the secondary color is a warm, paper-white that prevents the UI from feeling sterile.

- **Primary:** Radiant Orange, used for interactive elements and brand highlights.
- **Secondary:** Sun-kissed White, used for primary background surfaces to soften the overall look.
- **Neutral:** A range of zinc-based greys for text and borders, ensuring high legibility without the harshness of pure black.
- **Accent:** Translucent white overlays (20–40% opacity) are used to achieve the glassmorphic effect over primary and secondary backgrounds.

## Typography

The design system utilizes **Plus Jakarta Sans** across all levels to maintain a friendly and contemporary rhythm. The typeface's wide apertures and geometric foundations support the clean, airy nature of the brand.

Headlines should utilize tighter letter-spacing and heavier weights to provide a strong visual anchor. Body text is set with generous line-height to ensure maximum readability against translucent or high-white backgrounds. Labels are often set in semi-bold to distinguish them from standard body copy at smaller scales.

## Layout & Spacing

This design system uses a **fluid 12-column grid** on desktop, transitioning to a 4-column grid on mobile. The spacing philosophy is rooted in a 4px/8px baseline rhythm to ensure mathematical harmony across all components.

- **Desktop (1280px+):** 12 columns, 24px gutters, 40px external margins.
- **Tablet (768px - 1279px):** 8 columns, 20px gutters, 24px external margins.
- **Mobile (Up to 767px):** 4 columns, 16px gutters, 16px external margins.

Layouts should prioritize vertical rhythm and excessive white space (64px+) between major sections to emphasize the "Minimalist" portion of the brand narrative.

## Elevation & Depth

Depth is conveyed through **Glassmorphism** and soft, atmospheric shadows. Rather than using traditional grey shadows, elevation is represented by:

1.  **Backdrop Blurs:** Surfaces use a 20px to 40px Gaussian blur on the background layer.
2.  **Translucency:** Surface colors are typically white at 40-70% opacity.
3.  **Ghost Outlines:** A 1px solid border at 20% white opacity sits on the edge of elevated containers to simulate light catching the edge of a glass pane.
4.  **Solar Glow:** High-elevation components (like active modals) use a very soft, diffused shadow tinted with a hint of the primary orange (`#ff6b00` at 10% opacity) to suggest a warm light source behind the element.

## Shapes

The shape language is defined by modern, approachable curves. A `rounded-lg` standard is applied to all primary containers to complement the soft terminals of the Plus Jakarta Sans typeface.

- **Standard Components:** 0.5rem (8px) corner radius.
- **Cards & Sections:** 1rem (16px) corner radius.
- **Large Modals:** 1.5rem (24px) corner radius.

Avoid sharp 90-degree corners to maintain the friendly, "Solar" persona of the design system.

## Components

### Buttons
Primary buttons are solid `#ff6b00` with white text. Secondary buttons utilize a glassmorphic style: a semi-transparent white background with the ghost outline and orange text. All buttons should have a 0.5rem corner radius.

### Cards
Cards are the primary vehicle for the glassmorphic effect. They must feature a background blur, a subtle 1px white border, and should be placed over slightly warmer or dynamic background colors to allow the translucency to shine.

### Input Fields
Inputs should be clean with a 1px neutral-300 border. On focus, the border transitions to the primary orange with a 4px soft orange outer glow.

### Chips & Tags
Chips are pill-shaped (using `rounded-xl` logic) and use low-saturation versions of the primary color to indicate categorization without distracting from the main CTA.

### Selection Controls
Checkboxes and radio buttons use the primary orange for the selected state. The "unselected" state should be a subtle, translucent grey border to maintain the "Solar Minimalism" lightness.