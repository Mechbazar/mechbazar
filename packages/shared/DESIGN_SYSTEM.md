# MechBazar Design System

A unified, accessible, and responsive design system ensuring consistency across all MechBazar applications (web, mobile, iOS, Android, tablets).

## Overview

The MechBazar Design System provides:
- **Color Palette**: Unified brand colors (Red #db0000, Navy #02427a)
- **Typography**: Consistent font sizes, weights, and line heights
- **Spacing**: Standardized margins and padding
- **Components**: Reusable UI components for web and mobile
- **Responsive Design**: Mobile-first approach supporting all screen sizes
- **Accessibility**: WCAG AA compliance with proper contrast ratios

---

## Color System

### Brand Colors

#### Primary (Red)
- `primary-50`: #ffe5e5 (lightest)
- `primary-500`: #db0000 (brand color)
- `primary-900`: #4f0000 (darkest)

#### Navy
- `navy-50`: #e8eef7 (lightest)
- `navy-500`: #02427a (brand color)
- `navy-900`: #01224a (darkest)

#### Semantic Colors
- **Success**: #28a745 - Positive actions, confirmations
- **Warning**: #ffc107 - Warnings, caution
- **Danger**: #db0000 - Errors, destructive actions
- **Info**: #17a2b8 - Information, neutral messages

#### Neutral
- `neutral-50`: #fafafa (background)
- `neutral-900`: #222222 (text)

### Color Usage Guidelines

```
Primary (Red):       Main CTAs, highlights, active states
Navy:               Secondary CTAs, navigation, headers
Success (Green):    Confirmations, success messages
Warning (Yellow):   Alerts, caution messages
Danger (Red):       Errors, destructive actions
Neutral (Gray):     Text, borders, backgrounds
```

---

## Typography

### Font Family
- **Primary Font**: Inter (sans-serif)
- **Mono Font**: JetBrains Mono

### Font Sizes

| Name | Size | Weight | Line Height |
|------|------|--------|-------------|
| h1   | 40px | 700    | 1.1         |
| h2   | 32px | 700    | 1.25        |
| h3   | 24px | 700    | 1.35        |
| h4   | 20px | 600    | 1.4         |
| h5   | 16px | 600    | 1.5         |
| h6   | 14px | 600    | 1.57        |
| body-lg | 16px | 400  | 1.5         |
| body-md | 14px | 400  | 1.43        |
| body-sm | 12px | 400  | 1.33        |

### Font Weights
- Light: 300
- Normal: 400
- Medium: 500
- Semibold: 600
- Bold: 700
- Extrabold: 800

---

## Spacing Scale

Used for margins, paddings, and gaps:

```
0    = 0px
1    = 4px
2    = 8px
3    = 12px
4    = 16px (base unit)
5    = 20px
6    = 24px
8    = 32px
10   = 40px
12   = 48px
16   = 64px
20   = 80px
24   = 96px
```

### Spacing Guidelines
- **Components**: Use `spacing-4` (16px) as base padding
- **Sections**: Use `spacing-8` (32px) between major sections
- **Mobile**: Use `spacing-4` (16px) for screen edges
- **Web**: Use `spacing-6` (24px) for screen edges

---

## Components

### Web Components (React/Tailwind)

#### Button
```tsx
import { Button } from '@shared/components/web';

<Button 
  variant="primary" 
  size="md"
  onClick={handleClick}
>
  Click Me
</Button>

// Variants: primary | secondary | danger | outline | ghost | success
// Sizes: sm | md | lg
```

#### Card
```tsx
import { Card } from '@shared/components/web';

<Card variant="elevated">
  Card content here
</Card>

// Variants: elevated | outlined | filled
```

#### Input
```tsx
import { Input } from '@shared/components/web';

<Input 
  label="Email" 
  error="Invalid email"
  placeholder="your@email.com"
/>
```

#### Badge
```tsx
import { Badge } from '@shared/components/web';

<Badge variant="primary" size="md">
  New
</Badge>

// Variants: primary | secondary | success | warning | danger | info
// Sizes: sm | md | lg
```

#### Dialog
```tsx
import { Dialog } from '@shared/components/web';

<Dialog 
  isOpen={open}
  onClose={handleClose}
  title="Confirm Action"
>
  Confirm this action?
</Dialog>
```

#### Alert
```tsx
import { Alert } from '@shared/components/web';

<Alert 
  type="success"
  title="Success!"
  message="Operation completed"
  dismissible
/>

// Types: success | error | warning | info
```

#### Tabs
```tsx
import { Tabs } from '@shared/components/web';

<Tabs 
  tabs={[
    { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
    { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
  ]}
/>
```

### Mobile Components (React Native)

#### Button
```tsx
import { Button } from '@shared/components/mobile';

<Button 
  title="Press Me"
  variant="primary"
  size="md"
  onPress={handlePress}
/>
```

#### Card
```tsx
import { Card } from '@shared/components/mobile';

<Card variant="elevated">
  <Text>Card content</Text>
</Card>
```

#### Input
```tsx
import { Input } from '@shared/components/mobile';

<Input 
  label="Email"
  placeholder="your@email.com"
  error="Invalid"
/>
```

#### Badge
```tsx
import { Badge } from '@shared/components/mobile';

<Badge label="New" variant="primary" />
```

#### Loader
```tsx
import { Loader } from '@shared/components/mobile';

<Loader size="large" color="#db0000" />
```

---

## Icons

**Web**: Use [Lucide Icons](https://lucide.dev/)
```tsx
import { Check, X, AlertCircle } from 'lucide-react';
```

**Mobile**: Use [Expo Vector Icons](https://icons.expo.fyi/)
```tsx
import { Ionicons, FontAwesome } from '@expo/vector-icons';
```

---

## Responsive Breakpoints

| Name   | Pixel | CSS        |
|--------|-------|-----------|
| Mobile | 0px   | -         |
| Tablet | 768px | `@media (min-width: 768px)` |
| Desktop| 1024px| `@media (min-width: 1024px)` |
| XL     | 1280px| `@media (min-width: 1280px)` |

### Mobile-First Approach
Always design for mobile first, then add responsive behavior:

```tsx
// Base (mobile)
<div className="p-4 text-sm">
  // Tablet
  md:p-6 md:text-base
  // Desktop
  lg:p-8 lg:text-lg
</div>
```

---

## Shadows

### Web (Tailwind)
```
shadow-xs   - Minimal elevation
shadow-sm   - Subtle cards
shadow-base - Default cards
shadow-md   - Modals, dropdowns
shadow-lg   - Floating elements
shadow-xl   - Top-level modals
```

### Mobile
All shadows automatically adapt for Android/iOS elevation

---

## Border Radius

```
rounded-xs    = 2px   (minimal)
rounded-sm    = 4px   (form inputs)
rounded-base  = 6px   (buttons)
rounded-md    = 8px   (cards)
rounded-lg    = 12px  (large cards)
rounded-xl    = 16px  (modals)
rounded-full  = 9999px (pills)
```

---

## Transitions & Animations

### Duration
- `duration-100` - Quick feedback (100ms)
- `duration-200` - Standard (200ms)
- `duration-300` - Default animations (300ms)
- `duration-500` - Slower transitions (500ms)

### Animations
```css
animate-fade-in      /* Fade in over 300ms */
animate-slide-in     /* Slide up over 300ms */
animate-pulse-subtle /* Subtle pulse loop */
```

---

## Implementation Guide

### 1. Web Apps (Admin, Vendor)

#### Step 1: Update Tailwind Config
```js
// tailwind.config.js - Already updated with MechBazar colors
```

#### Step 2: Import Web Components
```tsx
import { Button, Card, Input, Badge } from '@shared/components/web';
```

#### Step 3: Use MechBazar Colors
```tsx
// Instead of: className="bg-blinkit-green"
// Use:
<div className="bg-primary-500">Primary Red</div>
<div className="bg-navy-500">Navy Blue</div>
<div className="text-primary-500">Text Red</div>
```

#### Step 4: Apply Spacing System
```tsx
// Instead of: p-8 m-4
// Use standardized scale:
<div className="p-4 m-2 gap-3">
  // Responsive:
  md:p-6 md:m-4 md:gap-4
  lg:p-8 lg:m-6 lg:gap-6
</div>
```

### 2. Mobile Apps (Admin Mobile, Seller Mobile, Delivery Mobile)

#### Step 1: Import Mobile Components
```tsx
import { 
  Button, 
  Card, 
  Input, 
  Badge, 
  Loader 
} from '@shared/components/mobile';
```

#### Step 2: Use Shared Theme
```tsx
import { colors, spacing, radius } from '@shared/theme';

<Card style={{ padding: spacing.lg }}>
  <Button 
    title="Submit"
    onPress={handlePress}
  />
</Card>
```

#### Step 3: Apply Consistent Styling
```tsx
// Use shared spacing and colors
const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.card,
  },
});
```

---

## Accessibility Standards

### WCAG AA Compliance

1. **Color Contrast**
   - Text on background: minimum 4.5:1
   - Large text: minimum 3:1
   - All color palettes meet requirements

2. **Keyboard Navigation**
   - All interactive elements accessible via keyboard
   - Proper tab order maintained
   - Focus indicators visible

3. **Screen Readers**
   - Semantic HTML used
   - ARIA labels for custom components
   - Mobile: VoiceOver/TalkBack compatible

4. **Touch Targets**
   - Minimum 44x44px for mobile buttons
   - Adequate spacing between interactive elements

### Implementation Tips
```tsx
// Web - Add ARIA labels
<button 
  aria-label="Close dialog"
  className="text-neutral-500 hover:text-neutral-700"
>
  <X size={24} />
</button>

// Mobile - Add accessibility labels
<TouchableOpacity 
  accessible={true}
  accessibilityLabel="Delete item"
  accessibilityRole="button"
>
  <Icon name="trash" />
</TouchableOpacity>
```

---

## Dark Mode (Future)

The design system is prepared for dark mode support:
```tsx
// CSS Variables approach
:root {
  --color-primary: #db0000;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #ff6666;
  }
}
```

---

## Testing Checklist

- [ ] Colors meet WCAG AA contrast requirements
- [ ] Components responsive on mobile (320px), tablet (768px), desktop (1024px)
- [ ] Keyboard navigation works on web
- [ ] Screen reader announces content correctly
- [ ] Touch targets minimum 44x44px on mobile
- [ ] Loading states visible for async operations
- [ ] Error states clearly indicated
- [ ] Animations don't cause seizures (safe flashing)

---

## References

- [MechBazar Figma Design System](https://figma.com) (if available)
- [Lucide Icons](https://lucide.dev/)
- [Expo Vector Icons](https://icons.expo.fyi/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Tailwind CSS](https://tailwindcss.com/)
- [React Native Styling](https://reactnative.dev/docs/style)

---

## Support & Questions

For design system updates or component additions:
1. Document the component in this guide
2. Add TypeScript interfaces
3. Include accessibility features
4. Test across all platforms
5. Update all relevant apps

---

**Last Updated**: July 14, 2026
**Version**: 1.0.0
