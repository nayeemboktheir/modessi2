import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PageTransition } from '@/components/motion';
import { cn } from '@/lib/utils';
import Header from './Header';
import Footer from './Footer';
import MobileBottomNav from './MobileBottomNav';

/** Paths where the phone tab bar would cover the page's own primary action. */
const HIDE_BOTTOM_NAV = ['/checkout'];

/**
 * Shared chrome for every storefront page. Landing pages and the admin panel are
 * routed outside this layout and keep their own.
 */
const StoreLayout = () => {
  const { pathname } = useLocation();
  const showBottomNav = !HIDE_BOTTOM_NAV.includes(pathname);

  return (
    <div className={cn('flex min-h-screen flex-col overflow-x-clip bg-surface text-ink', showBottomNav && 'pb-16 md:pb-0')}>
      <Header />
      {/* min-w-0: a flex item otherwise grows to its widest unbreakable child
          (the product rails, marquees) and pushes the page past the phone's width. */}
      <main className="min-w-0 flex-1">
        {/* Inner boundary so a lazily loaded page never blanks the header. */}
        <Suspense fallback={<PageFallback />}>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </Suspense>
      </main>
      <Footer />
      {showBottomNav && <MobileBottomNav />}
    </div>
  );
};

const PageFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <span className="h-9 w-9 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
  </div>
);

export default StoreLayout;
