import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { m, AnimatePresence, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { selectCartCount, toggleCart } from '@/store/slices/cartSlice';
import { selectWishlistItems } from '@/store/slices/wishlistSlice';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Marquee } from '@/components/motion';
import { cn } from '@/lib/utils';
import shopLogo from '@/assets/shop-logo.png';

const DEFAULT_PROMO = 'সারা বাংলাদেশে ডেলিভারি · মানসম্মত পোশাকের নিশ্চয়তা';

const NAV_LINKS: { label: string; to: string }[] = [
  { label: 'হোম', to: '/' },
  { label: 'সব কালেকশন', to: '/products' },
  { label: 'থ্রি পিস', to: '/products?category=three-piece' },
  { label: 'আমাদের সম্পর্কে', to: '/about' },
  { label: 'যোগাযোগ', to: '/contact' },
];

function isActive(to: string, pathname: string, search: string) {
  const [path, query = ''] = to.split('?');
  if (path === '/') return pathname === '/';
  if (pathname !== path) return false;
  const params = new URLSearchParams(search);
  if (query) return new URLSearchParams(query).get('category') === params.get('category');
  return !params.get('category');
}

/** Count bubble that pops whenever its number changes. */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <m.span
          key={count}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 16 }}
          className={cn('absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface-paper', className)}
        >
          {count}
        </m.span>
      )}
    </AnimatePresence>
  );
}

const iconButton = 'relative grid h-10 w-10 place-items-center rounded-full text-ink-soft transition-colors hover:bg-brand-blush hover:text-brand';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const reduce = useReducedMotion();
  const cartCount = useAppSelector(selectCartCount);
  const wishlistItems = useAppSelector(selectWishlistItems);
  const { user, signOut, isAdmin } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);

  const { data: headerSettings } = useQuery({
    queryKey: ['header-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['site_name', 'site_logo', 'shop_logo_url']);

      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      data?.forEach(item => {
        settingsMap[item.key] = item.value;
      });

      return settingsMap;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // The promo strip text is edited from Admin -> Home Page (`header_promo`).
  const { data: promo } = useQuery({
    queryKey: ['header-promo'],
    queryFn: async () => {
      const { data } = await supabase
        .from('home_page_content')
        .select('content')
        .eq('section_key', 'header_promo')
        .maybeSingle();
      const content = (data?.content || {}) as { enabled?: boolean; text?: string };
      return { enabled: content.enabled !== false, text: content.text?.trim() || DEFAULT_PROMO };
    },
    staleTime: 5 * 60 * 1000,
  });

  const siteName = headerSettings?.site_name || 'Modessi';

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (y) => {
    setScrolled(y > 12);
    // Slide away on the way down, return on the way up.
    const goingDown = y > lastY.current;
    if (Math.abs(y - lastY.current) > 6) setHidden(goingDown && y > 180);
    lastY.current = y;
  });

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const locked = menuOpen || searchOpen;
    document.body.style.overflow = locked ? 'hidden' : '';
    if (!locked) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, searchOpen]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    navigate(query.trim() ? '/products?search=' + encodeURIComponent(query.trim()) : '/products');
    setQuery('');
    setSearchOpen(false);
  };

  const accountHref = user ? (isAdmin ? '/admin' : '/my-account') : '/auth';
  const showPromo = promo?.enabled !== false;

  return (
    <>
      {showPromo && (
        <div className="bg-brand-deep text-white">
          <Marquee duration={38} className="h-10 items-center text-xs font-semibold tracking-wide sm:h-12 sm:text-sm">
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={index} className="flex items-center gap-10 px-5 whitespace-nowrap">
                {promo?.text || DEFAULT_PROMO}
                <span className="text-gold">✦</span>
              </span>
            ))}
          </Marquee>
        </div>
      )}

      <m.header
        animate={{ y: hidden && !menuOpen && !searchOpen && !reduce ? '-100%' : '0%' }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'sticky top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-300',
          scrolled
            ? 'border-line/80 bg-surface-paper/85 shadow-[0_8px_30px_-12px_rgba(74,30,40,0.18)] backdrop-blur-xl'
            : 'border-line bg-surface-paper/95 backdrop-blur-md',
        )}
      >
        <div className={cn('shell flex items-center justify-between gap-4 transition-[height] duration-300', scrolled ? 'h-[62px]' : 'h-[70px] lg:h-[78px]')}>
          <button type="button" aria-label="মেনু খুলুন" onClick={() => setMenuOpen(true)} className={cn(iconButton, 'lg:hidden')}>
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/" aria-label="Modessi home" className="shrink-0 lg:mr-6">
            <m.img
              src={shopLogo}
              alt={siteName}
              whileHover={reduce ? undefined : { scale: 1.04 }}
              className={cn('w-auto transition-[height] duration-300', scrolled ? 'h-9' : 'h-10 sm:h-11')}
            />
          </Link>

          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.to, location.pathname, location.search);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn('relative px-3.5 py-2 text-[13.5px] font-semibold transition-colors', active ? 'text-brand' : 'text-ink-soft hover:text-brand')}
                >
                  {link.label}
                  {active && (
                    <m.span layoutId="nav-underline" className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-0.5">
            <button type="button" aria-label="পণ্য খুঁজুন" onClick={() => setSearchOpen(true)} className={iconButton}>
              <Search className="h-[19px] w-[19px]" />
            </button>

            <div className="group relative hidden sm:block">
              <Link to={accountHref} aria-label="অ্যাকাউন্ট" className={iconButton}>
                {user && isAdmin ? <LayoutDashboard className="h-[19px] w-[19px]" /> : <User className="h-[19px] w-[19px]" />}
              </Link>
              {user && (
                <div className="invisible absolute right-0 top-full translate-y-2 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="min-w-[200px] rounded-2xl border border-line bg-white p-2 shadow-[0_20px_45px_-18px_rgba(74,30,40,0.35)]">
                    <p className="truncate px-3 pb-2 pt-1 text-xs text-ink-muted">{user.email}</p>
                    {isAdmin && (
                      <Link to="/admin" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-brand-blush hover:text-brand">
                        <LayoutDashboard className="h-4 w-4" /> অ্যাডমিন প্যানেল
                      </Link>
                    )}
                    <Link to="/my-account" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-brand-blush hover:text-brand">
                      <Package className="h-4 w-4" /> আমার অর্ডার
                    </Link>
                    <button type="button" onClick={() => signOut()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/5">
                      <LogOut className="h-4 w-4" /> লগআউট
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Link to="/wishlist" aria-label="উইশলিস্ট" className={cn(iconButton, 'hidden sm:grid')}>
              <Heart className={cn('h-[19px] w-[19px] transition-colors', wishlistItems.length && 'fill-brand text-brand')} />
              <CountBadge count={wishlistItems.length} />
            </Link>

            <button type="button" aria-label="কার্ট" onClick={() => dispatch(toggleCart())} className={iconButton}>
              <ShoppingBag className="h-[19px] w-[19px]" />
              <CountBadge count={cartCount} />
            </button>
          </div>
        </div>
      </m.header>

      {/* Search sheet */}
      <AnimatePresence>
        {searchOpen && (
          <m.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="বন্ধ করুন" className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
            <m.div
              initial={{ y: '-100%' }}
              animate={{ y: 0 }}
              exit={{ y: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="relative bg-surface-paper shadow-2xl"
            >
              <form onSubmit={handleSearch} className="mx-auto flex max-w-[760px] items-center gap-2 px-4 py-5 sm:px-6 sm:py-7">
                <Search className="h-5 w-5 shrink-0 text-brand" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="আপনার পছন্দের পণ্য খুঁজুন"
                  className="h-12 min-w-0 flex-1 border-b-2 border-line bg-transparent px-2 text-base text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-brand sm:text-lg"
                />
                <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-deep">
                  খুঁজুন <ArrowRight className="hidden h-4 w-4 sm:block" />
                </button>
                <button type="button" aria-label="বন্ধ করুন" onClick={() => setSearchOpen(false)} className={iconButton}>
                  <X className="h-5 w-5" />
                </button>
              </form>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Mobile menu drawer */}
      <AnimatePresence>
        {menuOpen && (
          <m.div className="fixed inset-0 z-[60] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="বন্ধ করুন" className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
            <m.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 34 }}
              className="relative flex h-full w-[84%] max-w-[340px] flex-col bg-surface-paper shadow-2xl"
            >
              <div className="flex h-[70px] items-center justify-between border-b border-line px-5">
                <img src={shopLogo} alt={siteName} className="h-10 w-auto" />
                <button type="button" aria-label="মেনু বন্ধ করুন" onClick={() => setMenuOpen(false)} className={iconButton}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <m.nav
                className="flex-1 overflow-y-auto px-3 py-4"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } } }}
              >
                {NAV_LINKS.map((link) => {
                  const active = isActive(link.to, location.pathname, location.search);
                  return (
                    <m.div key={link.to} variants={{ hidden: { opacity: 0, x: -24 }, show: { opacity: 1, x: 0 } }}>
                      <Link
                        to={link.to}
                        className={cn('flex items-center justify-between rounded-xl px-4 py-3.5 text-[15px] font-semibold transition-colors', active ? 'bg-brand-blush text-brand' : 'text-ink-soft hover:bg-surface-warm')}
                      >
                        {link.label}
                        <ArrowRight className={cn('h-4 w-4 transition-transform', active ? 'text-brand' : 'text-ink-muted')} />
                      </Link>
                    </m.div>
                  );
                })}
              </m.nav>

              <div className="space-y-1 border-t border-line p-3">
                <Link to={user ? '/my-account' : '/auth'} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-ink-soft hover:bg-surface-warm">
                  <User className="h-4 w-4 text-brand" /> আমার অ্যাকাউন্ট
                </Link>
                {user && isAdmin && (
                  <Link to="/admin" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-ink-soft hover:bg-surface-warm">
                    <LayoutDashboard className="h-4 w-4 text-brand" /> অ্যাডমিন প্যানেল
                  </Link>
                )}
                {user && (
                  <button type="button" onClick={() => { signOut(); setMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/5">
                    <LogOut className="h-4 w-4" /> লগআউট
                  </button>
                )}
              </div>
            </m.aside>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
