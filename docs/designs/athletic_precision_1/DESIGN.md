---
name: Athletic Precision
colors:
  surface: '#101225'
  surface-dim: '#101225'
  surface-bright: '#36384d'
  surface-container-lowest: '#0a0c20'
  surface-container-low: '#181a2e'
  surface-container: '#1c1e32'
  surface-container-high: '#26283d'
  surface-container-highest: '#313349'
  on-surface: '#e0e0fc'
  on-surface-variant: '#e0bfb7'
  inverse-surface: '#e0e0fc'
  inverse-on-surface: '#2d2f44'
  outline: '#a78a83'
  outline-variant: '#58413b'
  surface-tint: '#ffb5a1'
  primary: '#ffb5a1'
  on-primary: '#611300'
  primary-container: '#ff724c'
  on-primary-container: '#681600'
  inverse-primary: '#ab3514'
  secondary: '#f9bc4d'
  on-secondary: '#432c00'
  secondary-container: '#bd8718'
  on-secondary-container: '#3a2600'
  tertiary: '#c6c6ca'
  on-tertiary: '#2f3034'
  tertiary-container: '#9c9da1'
  on-tertiary-container: '#333538'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbd1'
  primary-fixed-dim: '#ffb5a1'
  on-primary-fixed: '#3c0800'
  on-primary-fixed-variant: '#881f00'
  secondary-fixed: '#ffdeac'
  secondary-fixed-dim: '#f9bc4d'
  on-secondary-fixed: '#281900'
  on-secondary-fixed-variant: '#5f4100'
  tertiary-fixed: '#e2e2e6'
  tertiary-fixed-dim: '#c6c6ca'
  on-tertiary-fixed: '#1a1c1f'
  on-tertiary-fixed-variant: '#45474a'
  background: '#101225'
  on-background: '#e0e0fc'
  surface-variant: '#313349'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Inter
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
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

This design system is engineered for high-performance athletic and fitness environments. The brand personality is energetic, focused, and meticulous, aimed at users who value discipline and measurable progress. 

The visual style follows a **Modern / Corporate** aesthetic with high-performance tweaks: high-contrast color pairings and ultra-functional typography. It utilizes a "Dark Mode" default to reduce eye strain in gym environments and to create a premium, "stealth" feel. The interface emphasizes clarity through a systematic hierarchy, allowing users to consume data and take action with split-second efficiency.

## Colors

The palette is anchored by **Deep Charcoal (#2A2C41)**, which serves as the primary background and structural color. This creates a high-contrast foundation for our action colors.

- **Primary Action:** Vibrant Orange (#FF724C) is used for critical call-to-actions, primary buttons, and active states.
- **Secondary Accent:** Golden Yellow (#FDBF50) highlights secondary data points, motivational markers, or warnings.
- **Contrast / Text:** Off-White (#F4F4F8) is reserved for high-readability body copy and headers on dark backgrounds.
- **Functional Neutrals:** Use varying opacities of the Charcoal or Off-White for borders, dividers, and disabled states.

## Typography

The design system exclusively utilizes **Inter** to ensure a systematic and utilitarian feel. The type scale is designed for rapid information scanning.

Headlines use tight tracking and bold weights to communicate strength and urgency. Body text maintains generous line heights for readability during physical activity. Labels are often rendered in uppercase with slight tracking to differentiate them from interactive elements and to provide a technical, "data-tag" aesthetic.

## Layout & Spacing

The layout follows a **Fluid Grid** model based on a 4px baseline shift. 

- **Mobile:** 4-column layout with 16px margins and 16px gutters.
- **Tablet:** 8-column layout with 24px margins and 16px gutters.
- **Desktop:** 12-column layout with a maximum container width of 1280px, 32px margins, and 24px gutters.

Spacing follows a geometric progression. Use `md` (24px) for most vertical spacing between sections to maintain a balanced but dense information density. Large `xl` (64px) gaps should only be used to separate major logical groups on desktop.

## Elevation & Depth

This system avoids traditional shadows to maintain a sleek, technical look. Depth is achieved through **Tonal Layering** and **Low-Contrast Outlines**.

- **Surface Level 0 (Base):** Deep Charcoal (#2A2C41).
- **Surface Level 1 (Cards/Modals):** A slightly lighter shade of Charcoal (approx. 5-8% lighter) to create separation.
- **Outlines:** Use a 1px border of Off-White at 10% opacity for container boundaries.
- **Active Elevation:** When an element is focused or active, use a 1px solid Vibrant Orange border rather than a shadow. This reinforces the "Precision" aspect of the brand.

## Shapes

The shape language is defined as **Soft**, utilizing a standard 4px (0.25rem) corner radius.

This subtle rounding maintains the disciplined, professional look of sharp corners while providing just enough "modern tech" softness to feel premium. 
- Standard components (Inputs, Buttons): 4px.
- Larger containers (Cards, Modals): 8px (`rounded-lg`).
- Feature sections: 12px (`rounded-xl`).
- Do not use pill shapes except for specific notification badges.

## Components

### Buttons
- **Primary:** Solid Vibrant Orange background with Deep Charcoal text. 4px radius. 
- **Secondary:** Transparent background with an 1.5px Vibrant Orange border.
- **Ghost:** Off-White text with no background, used for less critical actions.

### Input Fields
- Background is a step lighter than the base surface. 
- 1px border in Off-White (20% opacity). 
- Active state: Border becomes 1.5px Vibrant Orange. 
- Placeholder text: Off-White at 40% opacity.

### Cards
- Background: Level 1 Surface (slightly lightened Charcoal).
- Border: 1px subtle outline.
- Header: Use `label-md` for categories within cards for a technical feel.

### Chips & Tags
- Used for workout types or status. 
- Small 4px radius. 
- Utilize Golden Yellow for "Warning" or "High Intensity" tags. 
- Backgrounds should be low-opacity versions of the accent colors (e.g., Orange at 15% opacity with solid Orange text).

### Progress Bars
- Track: Deep Charcoal (darker than background).
- Fill: Vibrant Orange.
- Use Golden Yellow for "Milestone" markers within the track.