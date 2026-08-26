import { useEffect, useState } from 'react';

interface MobileViewportInsets {
  browserBottom: number;
  keyboardOpen: boolean;
}

const KEYBOARD_THRESHOLD = 180;
const MAX_BROWSER_CHROME = 120;

/**
 * Mobile browsers can place dynamic browser chrome below the CSS layout
 * viewport. safe-area-inset-bottom only covers device cutouts/home indicators,
 * so use VisualViewport to measure the extra occluded space when available.
 *
 * A large viewport delta is treated as the software keyboard instead of browser
 * chrome; the app shell hides bottom navigation while the keyboard is open.
 */
export function useMobileViewportInsets(): MobileViewportInsets {
  const [state, setState] = useState<MobileViewportInsets>({ browserBottom: 0, keyboardOpen: false });

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      const occludedBottom = Math.max(
        0,
        Math.round(window.innerHeight - (viewport.height + viewport.offsetTop)),
      );
      const keyboardOpen = window.innerHeight - viewport.height > KEYBOARD_THRESHOLD;
      const browserBottom = keyboardOpen ? 0 : Math.min(occludedBottom, MAX_BROWSER_CHROME);

      setState((current) =>
        current.browserBottom === browserBottom && current.keyboardOpen === keyboardOpen
          ? current
          : { browserBottom, keyboardOpen },
      );
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return state;
}
