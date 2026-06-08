---
name: Athletic Precision
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#41493e'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0ef'
  outline: '#717a6d'
  outline-variant: '#c0c9bb'
  surface-tint: '#2a6b2c'
  primary: '#00450d'
  on-primary: '#ffffff'
  primary-container: '#1b5e20'
  on-primary-container: '#90d689'
  inverse-primary: '#91d78a'
  secondary: '#785900'
  on-secondary: '#ffffff'
  secondary-container: '#fdc003'
  on-secondary-container: '#6c5000'
  tertiary: '#6b1d3d'
  on-tertiary: '#ffffff'
  tertiary-container: '#883454'
  on-tertiary-container: '#ffaec6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#acf4a4'
  primary-fixed-dim: '#91d78a'
  on-primary-fixed: '#002203'
  on-primary-fixed-variant: '#0c5216'
  secondary-fixed: '#ffdf9e'
  secondary-fixed-dim: '#fabd00'
  on-secondary-fixed: '#261a00'
  on-secondary-fixed-variant: '#5b4300'
  tertiary-fixed: '#ffd9e2'
  tertiary-fixed-dim: '#ffb1c8'
  on-tertiary-fixed: '#3e001d'
  on-tertiary-fixed-variant: '#7a2949'
  background: '#fcf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e5e2e1'
typography:
  display-score:
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
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  title-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  margin-mobile: 16px
  gutter: 12px
  card-padding: 16px
  list-item-gap: 8px
---

## Brand & Style
The design system is built for high-performance data consumption, catering to cricket enthusiasts, analysts, and scorers who require split-second readability. The brand personality is authoritative, energetic, and precise. It bridges the gap between the traditional prestige of the sport and the modern, data-driven nature of contemporary analytics.

The visual style is **Corporate / Modern** with an **Athletic** edge. It prioritizes clarity and information density over decorative elements. The UI should feel like a premium stadium scoreboard: high-contrast, organized, and unmistakably professional. White space is used strategically to prevent data fatigue, while bold color blocks signal key match events and primary actions.

## Colors
The palette is rooted in "Stadium Green" (#1B5E20), a deep, professional hue used for primary actions, navigation headers, and success states. This is contrasted against a "Crisp White" background to ensure maximum legibility during outdoor use or high-glare environments.

"Metric Gold" (#FFC107) serves as the secondary accent, reserved exclusively for highlighting critical statistics, player milestones (centuries, 5-wicket hauls), and active match states. A tiered neutral scale from deep charcoal (#212121) to light cool grays is utilized for secondary data and UI borders to maintain a clean hierarchy.

## Typography
This design system utilizes **Inter** for its exceptional legibility and neutral character, which is essential for handling dense numerical layouts. 

**Key Rules:**
- **Tabular Lining:** All numerical data (scores, strike rates, economy) must use tabular lining features to ensure columns of numbers align perfectly in tables.
- **Visual Hierarchy:** Use `display-score` for the main match total. Use `label-caps` for table headers (e.g., OVER, RUNS, WKTS) to differentiate metadata from actual values.
- **Emphasis:** Bold weights are reserved for active players or "Current Over" highlights to draw the eye immediately to the most relevant live data.

## Layout & Spacing
The layout follows a **Fluid Grid** model optimized for mobile devices. It utilizes an 8px base unit to maintain a strict vertical rhythm, which is crucial for data-heavy tables and scorecards.

- **Mobile:** A 4-column grid with 16px side margins. 
- **Density:** To accommodate the breadth of cricket statistics, the design system employs "Compact" and "Comfortable" density modes. Scorecards use compact spacing (8px) to fit full batting lineups on screen, while news feeds use comfortable spacing (16px).
- **Alignment:** Data values are right-aligned in tables to allow for easy comparison of digit length, while player names are left-aligned.

## Elevation & Depth
To maintain the "Athletic Precision" aesthetic, this design system avoids heavy shadows. Instead, it utilizes **Tonal Layers** and **Low-Contrast Outlines** to define hierarchy.

- **Level 0 (Background):** Pure white (#FFFFFF).
- **Level 1 (Cards/Containers):** Subtly off-white or defined by a 1px border (#E0E0E0).
- **Level 2 (Active States):** Surface-tinted with a very light version of the primary green (5% opacity) to denote "In-Play" or "Active" sections.
- **Dividers:** Hairline dividers (0.5px) are used between ball-by-ball entries to provide structure without adding visual bulk.

## Shapes
The shape language is **Soft (Level 1)**. Elements like buttons and cards use a 0.25rem (4px) radius. This subtle rounding maintains a professional, "engineered" look while feeling modern. 

Circular shapes are used exclusively for specific cricket-related indicators, such as "The Ball" in ball-by-ball tracking or player profile avatars, creating a clear distinction between UI containers and specific data points.

## Components
- **Buttons:** Primary buttons are solid Stadium Green with white text. Secondary buttons use a Metric Gold outline for high-visibility "Live" actions.
- **Score Chips:** Small, rounded indicators for match events (W, 4, 6). Wickets (W) use a high-contrast dark fill, while boundaries use a Gold fill to celebrate the event.
- **Scorecards:** Use a "Zebrastriping" technique (very light gray backgrounds on alternate rows) for long batting lineups to help the eye track across the row.
- **Input Fields:** Outlined with a 1px border. The label moves to a floating position on focus to maximize space in data-entry forms.
- **Match Header:** A persistent top-level component that stays pinned during scrolls, showing the current score, overs, and run rate in a condensed format.
- **Progress Bars:** Thin, linear bars used for "Run Rate" comparisons or "Win Probability," utilizing the Green and Gold palette to show team splits.