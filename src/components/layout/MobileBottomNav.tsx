import { Link, useLocation } from 'react-router-dom';
import { m } from 'framer-motion';
import { Heart, Home, LayoutGrid, ShoppingBag, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openCart, selectCartCount, selectIsCartOpen } from '@/store/slices/cartSlice';
import { selectWishlistItems } from '@/store/slices/wishlistSlice';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { CountBadge } from './Header';

type Item = { key: string; label: string; icon: LucideIcon; to?: string; count?: number; active: boolean };

/** App-style tab bar for phones. Hidden from md up and on checkout. */
const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const cartCount = useAppSelector(selectCartCount);
  const cartOpen = useAppSelector(selectIsCartOpen);
  const wishlistCount = useAppSelector(selectWishlistItems).length;

  const items: Item[] = [
    { key: 'home', label: 'হোম', icon: Home, to: '/', active: pathname === '/' && !cartOpen },
    { key: 'shop', label: 'শপ', icon: LayoutGrid, to: '/products', active: (pathname.startsWith('/products') || pathname.startsWith('/product/')) && !cartOpen },
    { key: 'cart', label: 'কার্ট', icon: ShoppingBag, count: cartCount, active: cartOpen || pathname === '/cart' },
    { key: 'wishlist', label: 'উইশলিস্ট', icon: Heart, to: '/wishlist', count: wishlistCount, active: pathname === '/wishlist' && !cartOpen },
    { key: 'account', label: 'অ্যাকাউন্ট', icon: User, to: user ? '/my-account' : '/auth', active: (pathname === '/my-account' || pathname === '/auth') && !cartOpen },
  ];

  return (
    <nav aria-label="মোবাইল নেভিগেশন" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-paper/90 shadow-[0_-8px_30px_-12px_rgba(74,30,40,0.2)] backdrop-blur-xl md:hidden">
      <ul className="grid h-16 grid-cols-5">
        {items.map((item) => {
          const content = (
            <>
              {item.active && (
                <m.span
                  layoutId="bottom-nav-pill"
                  className="absolute inset-x-2 inset-y-1.5 rounded-2xl bg-brand-blush"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">
                <item.icon className={cn('h-[21px] w-[21px] transition-transform duration-300', item.active && '-translate-y-0.5 scale-110', item.key === 'wishlist' && item.active && 'fill-brand')} />
                {item.count !== undefined && <CountBadge count={item.count} className="-right-2.5 -top-1.5" />}
              </span>
              <span className="relative mt-0.5 text-[10px] font-semibold">{item.label}</span>
            </>
          );
          const className = cn('relative flex h-full w-full flex-col items-center justify-center transition-colors', item.active ? 'text-brand' : 'text-ink-muted');

          return (
            <li key={item.key}>
              {item.to ? (
                <Link to={item.to} className={className} aria-current={item.active ? 'page' : undefined}>{content}</Link>
              ) : (
                <button type="button" className={className} onClick={() => dispatch(openCart())}>{content}</button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;
