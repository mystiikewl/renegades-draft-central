import * as React from "react"

const MOBILE_SM = 480 // Small mobile
const MOBILE_LG = 640 // Large mobile/small tablet
const TABLET = 768   // Standard tablet breakpoint
const DESKTOP = 1024  // Desktop breakpoint

export type ResponsiveLayout = 'icon-only' | 'abbreviated' | 'full-text' | 'grid-layout'

export function useResponsive() {
  const [screenWidth, setScreenWidth] = React.useState<number>(0)
  const [isMobile, setIsMobile] = React.useState<boolean>(false)
  const [isSmallMobile, setIsSmallMobile] = React.useState<boolean>(false)
  const [isTablet, setIsTablet] = React.useState<boolean>(false)

  React.useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      setScreenWidth(width)
      setIsMobile(width < TABLET)
      setIsSmallMobile(width < MOBILE_SM)
      setIsTablet(width >= TABLET && width < DESKTOP)
    }

    // Set initial values
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const getTabLayout = (width: number): ResponsiveLayout => {
    if (width < MOBILE_SM) return 'icon-only'
    if (width < MOBILE_LG) return 'abbreviated'
    if (width < TABLET) return 'full-text'
    return 'grid-layout'
  }

  const tabLayout = getTabLayout(screenWidth)

  return {
    screenWidth,
    isMobile,
    isSmallMobile,
    isTablet,
    tabLayout,
    breakpoints: {
      MOBILE_SM,
      MOBILE_LG,
      TABLET,
      DESKTOP
    }
  }
}