# PlayerDetailsModal Mobile Tab Enhancement Plan

## Current Issues Identified

### 1. **Grid Layout Constraints**
- Current implementation uses `grid-cols-2` on mobile for 4 tabs
- Creates cramped 2×2 layout that doesn't scale well
- Potential horizontal overflow issues

### 2. **Touch Target Optimization**
- Default tab triggers may be too small for mobile interaction
- Need minimum 44px touch targets for accessibility
- Current padding: `px-3 py-1.5` (24px width, 12px height)

### 3. **Tab Label Visibility**
- Tab text completely hidden on mobile (`{!isMobile && 'Stats'}`)
- Users may not understand icon-only navigation
- Poor accessibility for screen readers

### 4. **Overflow Handling**
- No horizontal scroll consideration for tabs
- Fixed grid layout may not handle content overflow
- Dialog width constraints may cause tab clipping

## Proposed Solution: Mobile-First Responsive Tabs

### Strategy Overview
```
graph TD
    A[Mobile Detection] --> B{Horizontal Scrolling Tabs}
    B --> C[Touch-Optimized Layout]
    C --> D[Responsive Labels]
    D --> E[Improved Spacing]
```

### Implementation Phases

## Phase 1: Horizontal Scrolling Tabs

**Objective**: Replace grid layout with horizontal scrolling tabs on mobile

**Changes**:
- Remove `grid-cols-2` constraint on mobile
- Implement `flex overflow-x-auto` for horizontal scrolling
- Add scroll indicators/snap behavior
- Maintain `grid-cols-4` for desktop

**Code Structure**:
```tsx
<TabsList className={cn(
  "flex h-12 items-center justify-start", // Horizontal layout
  "overflow-x-auto scrollbar-hide", // Scroll behavior
  "snap-x snap-mandatory", // Snap scrolling
  isMobile ? "px-2 gap-1" : "grid w-full grid-cols-4"
)}>
```

## Phase 2: Touch Target Optimization

**Objective**: Ensure minimum 44px touch targets and proper spacing

**Changes**:
- Increase tab trigger padding for mobile
- Add minimum width constraints
- Optimize icon and text spacing
- Implement proper touch feedback

**Responsive Padding Strategy**:
- Mobile: `px-4 py-3` (32px width + padding = ~80px min width)
- Desktop: `px-3 py-1.5` (maintains current desktop UX)

## Phase 3: Responsive Tab Labels

**Objective**: Show abbreviated text on mobile while maintaining accessibility

**Changes**:
- Implement truncated text with tooltips
- Use abbreviated labels on small screens
- Maintain full text on larger mobile screens (tablets)
- Add aria-labels for screen readers

**Label Strategy**:
```tsx
// Mobile-first responsive text
const getTabLabel = (fullText: string, mobileText: string) => {
  if (!isMobile) return fullText;
  return isSmallMobile ? mobileText : fullText;
};
```

## Phase 4: Enhanced Mobile Styling

**Objective**: Improve visual hierarchy and user experience

**Changes**:
- Better visual separation between tabs
- Improved active/inactive states
- Enhanced scrolling indicators
- Optimized dialog padding and spacing

**Visual Enhancements**:
- Active tab background color
- Subtle shadow for depth
- Smooth scroll behavior
- Loading states for better UX

## Phase 5: Accessibility Improvements

**Objective**: Ensure WCAG compliance and screen reader support

**Changes**:
- Proper ARIA labels for icon-only tabs
- Keyboard navigation support
- Focus management for scrollable tabs
- Screen reader announcements

## Technical Implementation Details

### Responsive Breakpoints
```tsx
const MOBILE_SM = 480; // Small mobile
const MOBILE_LG = 640; // Large mobile/small tablet
const TABLET = 768;   // Standard tablet breakpoint

const getTabLayout = (width: number) => {
  if (width < MOBILE_SM) return 'icon-only';
  if (width < MOBILE_LG) return 'abbreviated';
  if (width < TABLET) return 'full-text';
  return 'grid-layout';
};
```

### Tab Component Updates

**Enhanced TabsList**:
```tsx
const MobileTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const { isMobile, screenWidth } = useResponsive();

  const layoutClass = isMobile
    ? "flex h-12 overflow-x-auto snap-x snap-mandatory scrollbar-hide"
    : "grid w-full grid-cols-4";

  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        layoutClass,
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.List>
  );
});
```

**Enhanced TabsTrigger**:
```tsx
const MobileTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const { isMobile } = useResponsive();

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        // Mobile-specific sizing
        isMobile ? "px-4 py-3 min-w-[80px] h-10 text-sm" : "px-3 py-1.5 text-sm font-medium",
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
});
```

## Testing Strategy

### Device Testing Matrix
- iPhone SE (375px width)
- iPhone 12/13 (390px width)
- iPhone 12/13 Pro Max (428px width)
- Samsung Galaxy S21 (360px width)
- iPad Mini (768px width)
- Desktop (1024px+ width)

### Test Cases
1. **Tab Navigation**: Swipe/scroll through tabs
2. **Touch Targets**: Verify 44px minimum touch area
3. **Content Display**: Check tab content renders correctly
4. **Overflow Handling**: Test with long tab names
5. **Accessibility**: Screen reader and keyboard navigation
6. **Orientation**: Portrait and landscape modes

## Success Metrics

### Performance
- No horizontal overflow on mobile devices
- Smooth scroll performance (60fps)
- Fast tab switching (<100ms)

### Usability
- All tabs accessible without horizontal scrolling (where possible)
- Clear visual feedback for active states
- Intuitive navigation patterns

### Accessibility
- WCAG 2.1 AA compliance
- Screen reader compatibility
- Keyboard navigation support

## Migration Strategy

### Backward Compatibility
- Desktop layout unchanged
- Existing props and API maintained
- Progressive enhancement approach

### Rollout Plan
1. **Alpha**: Internal testing with development team
2. **Beta**: Limited user group testing
3. **Production**: Gradual rollout with feature flags

## Risk Mitigation

### Potential Issues
1. **Browser Compatibility**: Test across iOS Safari, Chrome Mobile, Firefox Mobile
2. **Performance**: Monitor scroll performance on low-end devices
3. **Content Overflow**: Ensure long tab names are handled gracefully

### Fallback Strategy
- Graceful degradation to original grid layout if scroll fails
- Alternative tab navigation for accessibility needs
- Feature detection for advanced scroll behaviors

## Future Enhancements

### Phase 2 Features
- Tab swipe gestures
- Tab reordering for power users
- Persistent tab state across sessions
- Customizable tab layouts

---

**Note**: This plan focuses on mobile-first responsive design while maintaining desktop functionality. All changes will be implemented with progressive enhancement principles.