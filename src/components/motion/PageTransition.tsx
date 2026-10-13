import type { ReactNode } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

/**
 * Enter animation for each route. Exit is deliberately not animated: holding the
 * old page on screen would delay navigation, which costs more than it adds.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;

  return (
    <m.div
      key={pathname}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
