# Mentioned.pro Design Specifications

## For Animator / Designer Reference

---

## Brand Overview

**Product:** Mentioned.pro — AI Visibility Checker
**Tagline:** The world's simplest AI visibility checker
**Tone:** Professional, clean, trustworthy, modern SaaS

---

## Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Primary Blue** | `#2563EB` | rgb(37, 99, 235) | Buttons, links, primary actions |
| **Primary Blue Dark** | `#1D4ED8` | rgb(29, 78, 216) | Hover states |
| **Primary Blue Light** | `#3B82F6` | rgb(59, 130, 246) | Backgrounds, accents |

### Status Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Success/Excellent** | `#10B981` | rgb(16, 185, 129) | High scores (70+), checkmarks, positive |
| **Success Dark** | `#059669` | rgb(5, 150, 105) | Gradients, emphasis |
| **Success Light BG** | `#ECFDF5` | rgb(236, 253, 245) | Badge backgrounds |
| **Warning/Moderate** | `#F59E0B` | rgb(245, 158, 11) | Medium scores (40-69) |
| **Warning Light BG** | `#FFFBEB` | rgb(255, 251, 235) | Badge backgrounds |
| **Danger/Low** | `#EF4444` | rgb(239, 68, 68) | Low scores (<40), errors, X marks |
| **Danger Light BG** | `#FEF2F2` | rgb(254, 242, 242) | Badge backgrounds |

### Platform Brand Colors

| Platform | Hex | RGB |
|----------|-----|-----|
| **ChatGPT** | `#10A37F` | rgb(16, 163, 127) |
| **Claude** | `#D97706` | rgb(217, 119, 6) |

### Neutral Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Text Primary** | `#111827` | Headings, important text |
| **Text Secondary** | `#374151` | Body text |
| **Text Muted** | `#6B7280` | Captions, labels |
| **Text Light** | `#9CA3AF` | Placeholders, subtle text |
| **Border** | `#E5E7EB` | Card borders, dividers |
| **Background Light** | `#F9FAFB` | Section backgrounds |
| **Background** | `#F3F4F6` | Input backgrounds |
| **White** | `#FFFFFF` | Cards, primary background |

---

## Typography

### Font Family
- **Primary:** Inter (or system sans-serif fallback: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto)
- **Weights Used:** 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)

### Type Scale

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| H1 (Hero) | 48-64px | Bold (700) | #111827 |
| H2 (Section) | 24-32px | Bold (700) | #111827 |
| H3 (Card title) | 16-18px | Semibold (600) | #111827 |
| Body | 14-16px | Regular (400) | #374151 |
| Caption | 12px | Regular (400) | #6B7280 |
| Label | 10-11px | Medium (500) | #6B7280 |
| Score Large | 48-56px | Bold (700) | Status color |
| Score Medium | 28-32px | Bold (700) | Status color |

---

## Components

### Cards

```
Border Radius: 16px (large cards), 12px (small cards)
Shadow: 0 4px 24px rgba(0, 0, 0, 0.08)
Background: #FFFFFF
Border: 1px solid #E5E7EB (optional)
Padding: 24px (large), 16px (small)
```

### Buttons

**Primary Button**
```
Background: #2563EB
Text: #FFFFFF
Border Radius: 12px
Padding: 12px 24px
Font: 15px Semibold
Shadow: 0 4px 16px rgba(37, 99, 235, 0.25)
Hover: #1D4ED8
```

**Secondary Button**
```
Background: #FFFFFF
Text: #374151
Border: 1px solid #E5E7EB
Border Radius: 12px
Padding: 12px 24px
Font: 15px Medium
Hover: Background #F9FAFB
```

### Status Badges

```
Border Radius: 16px (full pill)
Padding: 6px 12px
Font: 13px Medium

Excellent: BG #ECFDF5, Text #10B981, Dot #10B981
Good: BG #EFF6FF, Text #3B82F6, Dot #3B82F6
Moderate: BG #FFFBEB, Text #F59E0B, Dot #F59E0B
Low: BG #FEF2F2, Text #EF4444, Dot #EF4444
```

### Progress Bars

```
Track: #E5E7EB, Height 6px, Border Radius 3px
Fill: Status color (green/yellow/red based on score)
Animation: Fill from left, 700ms ease-out
```

### Platform Icons

**ChatGPT**
```
Circle: 40px diameter
Background: #10A37F
Text: "G" in white, 16px Bold
```

**Claude**
```
Circle: 40px diameter
Background: #D97706
Text: "C" in white, 16px Bold
```

### Checkmark Icon
```
Circle: 24px diameter
Background: #ECFDF5
Checkmark: #10B981, 2px stroke
```

### X Mark Icon
```
Circle: 24px diameter
Background: #FEF2F2
X: #EF4444, 2px stroke
```

---

## Score Display Guidelines

### Score Thresholds

| Score Range | Status | Color | Label |
|-------------|--------|-------|-------|
| 80-100 | Excellent | #10B981 | "Excellent" |
| 60-79 | Good | #3B82F6 | "Good" |
| 40-59 | Moderate | #F59E0B | "Moderate" |
| 20-39 | Low | #EF4444 | "Low" |
| 0-19 | Not Visible | #EF4444 | "Not Visible" |

### Score Animation
- Count up from 0 to final value
- Duration: 1000-1200ms
- Easing: ease-out (cubic-bezier(0, 0, 0.2, 1))
- Color should match final score threshold

---

## Graph Specifications

### Visibility Progress Graph

```
Background: #F9FAFB
Line Color: Gradient from #059669 to #10B981 (or red if negative)
Line Width: 3px
Area Fill: Gradient from rgba(16, 185, 129, 0.3) to transparent
Data Points: 8px circles, #10B981 fill, 2px white stroke
Grid Lines: #E5E7EB, 1px, dashed
```

### Animation
- Line draws from left to right
- Duration: 1500ms
- Data points pulse slightly as line reaches them
- Area fills simultaneously with line

---

## Animation Guidelines

### General Principles
- Easing: Use ease-out for entrances, ease-in-out for transitions
- Duration: 200-400ms for micro-interactions, 500-800ms for major transitions
- Stagger: 50-100ms delay between sequential items

### Specific Animations

**Card Entrance**
```
From: opacity 0, translateY 20px, scale 0.95
To: opacity 1, translateY 0, scale 1
Duration: 400ms
Easing: ease-out
```

**Score Count Up**
```
Duration: 1200ms
Easing: ease-out (decelerate)
```

**Progress Bar Fill**
```
Duration: 700ms
Easing: ease-out
Delay: 200ms after card appears
```

**Checkmark Pop**
```
From: scale 0
To: scale 1
Duration: 300ms
Easing: spring (overshoot slightly)
```

**Button Hover**
```
Scale: 1.02
Shadow: increase by 20%
Duration: 150ms
```

---

## Logo

### Mark Only
- Circle outline, 2.5px stroke, #111827
- "M" in Georgia/serif font inside

### Logo + Text
- Mark (smaller, 2px stroke)
- "Mentioned" in Inter Semibold, #111827
- Gap: 12px between mark and text

---

## Spacing System

| Name | Size |
|------|------|
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |
| 2xl | 48px |
| 3xl | 64px |

---

## File Included

- `design-kit.svg` — Vector file with all UI components
  - Can be imported into Figma, Illustrator, or any vector editor
  - Contains: Logo, colors, buttons, score displays, badges, platform cards, query list, competitor cards, action plan cards, progress graph, stat cards, icons

---

## Questions?

Contact: Kyle Jira
Product: mentioned.pro
