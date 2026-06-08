---
name: Solar Minimalism
colors:
  surface: '#f9f9fd'
  surface-dim: '#d9dade'
  surface-bright: '#f9f9fd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f7'
  surface-container: '#ededf1'
  surface-container-high: '#e8e8ec'
  surface-container-highest: '#e2e2e6'
  on-surface: '#1a1c1f'
  on-surface-variant: '#58413b'
  inverse-surface: '#2f3034'
  inverse-on-surface: '#f0f0f4'
  outline: '#8c716a'
  outline-variant: '#e0bfb7'
  surface-tint: '#ab3514'
  primary: '#ab3514'
  on-primary: '#ffffff'
  primary-container: '#ff724c'
  on-primary-container: '#681600'
  inverse-primary: '#ffb5a1'
  secondary: '#7e5700'
  on-secondary: '#ffffff'
  secondary-container: '#fdbf50'
  on-secondary-container: '#714e00'
  tertiary: '#006a69'
  on-tertiary: '#ffffff'
  tertiary-container: '#00afae'
  on-tertiary-container: '#003b3b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd1'
  primary-fixed-dim: '#ffb5a1'
  on-primary-fixed: '#3c0800'
  on-primary-fixed-variant: '#881f00'
  secondary-fixed: '#ffdeac'
  secondary-fixed-dim: '#f9bc4d'
  on-secondary-fixed: '#281900'
  on-secondary-fixed-variant: '#5f4100'
  tertiary-fixed: '#74f6f5'
  tertiary-fixed-dim: '#53d9d8'
  on-tertiary-fixed: '#002020'
  on-tertiary-fixed-variant: '#00504f'
  background: '#f9f9fd'
  on-background: '#1a1c1f'
  surface-variant: '#e2e2e6'
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
  label-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
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
  container-margin: 24px
  gutter: 16px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style
This design system centers on a sophisticated fusion of minimalism and glassmorphism, capturing the warmth of sunlight filtered through architectural glass. It is designed for forward-thinking technology and lifestyle platforms that require a professional yet optimistic atmosphere. 

The aesthetic leverages high-clarity whitespace, vibrant solar accents, and translucent layering. The target audience values precision, modern aesthetics, and interfaces that feel "airy" and lightweight. The emotional response should be one of clarity, warmth, and effortless navigation.

## Colors
The palette is anchored by a cool, neutral base (#F4F4F8) which provides a clean canvas for glass effects. The primary orange (#FF724C) acts as the high-energy focal point for actions, while the secondary yellow (#FDBF50) provides supportive warmth for highlights and secondary information.

Glass surfaces are defined by a semi-transparent white fill (40% opacity) and a delicate white border (50% opacity). This creates a "frosted" appearance that allows the underlying background colors to bleed through subtly, maintaining a sense of depth and luminosity.

## Typography
Typography follows a systematic hierarchy of sharp, modern grotesque faces. **Hanken Grotesk** provides a clean, contemporary voice for headlines. **Inter** is utilized for body copy to ensure maximum legibility across all screen densities. **Geist** is reserved for labels and technical data, providing a precise, developer-friendly touch to the minimal layout. Large headlines use tighter letter-spacing for a more editorial feel, while small labels are tracked out for clarity.

## Layout & Spacing
The design system utilizes a 12-column fluid grid for desktop and a single-column fluid layout for mobile. A strict 8px baseline grid governs all vertical rhythm.

Layouts should favor generous negative space to emphasize the glass containers. Content sections are grouped within "frosted" cards that float above the base background. Padding within these glass containers should be ample (minimum 24px) to maintain the airy, minimalist aesthetic.

## Elevation & Depth
Depth is achieved through a combination of backdrop-blur filters and soft, ambient shadows. 

- **Level 1 (Base):** The neutral background (#F4F4F8).
- **Level 2 (Glass Containers):** 16px to 24px backdrop-blur, a 1px white border at 50% opacity, and a very soft, diffused shadow (0px 4px 24px rgba(0, 0, 0, 0.04)).
- **Level 3 (Interactive/Floating):** Increased shadow density (0px 8px 32px rgba(0, 0, 0, 0.08)) and a slight increase in border brightness to indicate hover or active states.

Shadows should never be pure black; they must be tinted slightly with the primary color's hue to maintain the "solar" warmth.

## Shapes
Shapes are defined by "Rounded" parameters (0.5rem base) to strike a balance between friendly and professional. This medium rounding is applied consistently to glass cards, input fields, and buttons. Interactive elements like "Pills" or "Tags" may use the `rounded-xl` setting (1.5rem) to differentiate them from structural layout elements.

## Components
- **Buttons:** Primary buttons use a solid #FF724C fill with white text. Secondary buttons are "Glass" style: semi-transparent white fill, white border, and orange text.
- **Glass Cards:** The signature component. Use `backdrop-filter: blur(20px)` with a 1px white border. Content should have high contrast against the blurred background.
- **Input Fields:** Soft grey backgrounds (#E9E9EF) that transition to a white glass-style on focus, highlighted by a 2px orange bottom-border.
- **Chips/Badges:** Small, high-radius (pill) shapes using the secondary yellow (#FDBF50) with 15% opacity and a solid yellow text label.
- **Lists:** Items separated by thin, low-opacity lines. On hover, the entire list item should take on a light glass effect.
- **Progress Bars:** Thin tracks using a light neutral color with a vibrant orange fill that has a subtle "glow" (outer glow shadow) at the leading edge.