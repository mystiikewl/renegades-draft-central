import { useEffect, useState } from 'react';

/** Tailwind's `sm:` breakpoint — matches the CSS, one source of truth. */
const SM_QUERY = '(min-width: 640px)';

function matches(): boolean {
  // ponytail: jsdom has no matchMedia; default to desktop there
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? true
    : window.matchMedia(SM_QUERY).matches;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => !matches());

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(SM_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(!e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
