import { lazy, Suspense } from 'react';
import { LazyMotion } from 'framer-motion';
import { Provider } from 'react-redux';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { store } from '@/store/store';
import { AuthProvider } from '@/hooks/useAuth';
import { FacebookPixelTracker } from '@/components/tracking/FacebookPixelTracker';
import GoogleAnalyticsTracker from '@/components/tracking/GoogleAnalyticsTracker';
import { TikTokPixelTracker } from '@/components/tracking/TikTokPixelTracker';
import CartDrawer from '@/components/cart/CartDrawer';
import FaviconLoader from '@/components/FaviconLoader';
import SocialChatWidget from '@/components/SocialChatWidget';

import FashionHomePage from '@/pages/FashionHomePage';



// Route components are code-split so a shopper does not download the 24-page admin
// panel (and recharts, and the landing builder) just to open the storefront. The
// home page stays eager: it is the most common entry point.
const OrderConfirmationPage = lazy(() => import('@/pages/OrderConfirmationPage'));
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const MyAccountPage = lazy(() => import('@/pages/MyAccountPage'));
const ProductsPage = lazy(() => import('@/pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage'));
const WishlistPage = lazy(() => import('@/pages/WishlistPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const CartPage = lazy(() => import('@/pages/CartPage'));
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'));
const ProductLandingPage = lazy(() => import('@/pages/ProductLandingPage'));
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const CottonTarselLandingPage = lazy(() => import('@/pages/CottonTarselLandingPage'));
const DigitalTarselLandingPage = lazy(() => import('@/pages/DigitalTarselLandingPage'));
const ReyonCottonLandingPage = lazy(() => import('@/pages/ReyonCottonLandingPage'));
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'));
const AdminWholesalePrices = lazy(() => import('@/pages/admin/AdminWholesalePrices'));
const AdminCategories = lazy(() => import('@/pages/admin/AdminCategories'));
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'));
const AdminIncompleteOrders = lazy(() => import('@/pages/admin/AdminIncompleteOrders'));
const AdminOrderProtection = lazy(() => import('@/pages/admin/AdminOrderProtection'));
const AdminCourierHistory = lazy(() => import('@/pages/admin/AdminCourierHistory'));
const AdminCourierSettings = lazy(() => import('@/pages/admin/AdminCourierSettings'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminInventory = lazy(() => import('@/pages/admin/AdminInventory'));
const AdminBanners = lazy(() => import('@/pages/admin/AdminBanners'));
const AdminShopSettings = lazy(() => import('@/pages/admin/AdminShopSettings'));
const AdminMarketing = lazy(() => import('@/pages/admin/AdminMarketing'));
const AdminSMS = lazy(() => import('@/pages/admin/AdminSMS'));
const AdminLandingPages = lazy(() => import('@/pages/admin/AdminLandingPages'));
const AdminLandingPageEditor = lazy(() => import('@/pages/admin/AdminLandingPageEditor'));
const AdminContactSubmissions = lazy(() => import('@/pages/admin/AdminContactSubmissions'));
const AdminSiteSettings = lazy(() => import('@/pages/admin/AdminSiteSettings'));
const AdminSocialMedia = lazy(() => import('@/pages/admin/AdminSocialMedia'));
const AdminReports = lazy(() => import('@/pages/admin/AdminReports'));
const AdminHomePageEdit = lazy(() => import('@/pages/admin/AdminHomePageEdit'));
const AdminLandingVideoSettings = lazy(() => import('@/pages/admin/AdminLandingVideoSettings'));

// Defaults, not per-query tuning. The stock QueryClient treats every result as
// immediately stale and refetches the whole active set on each window focus —
// on the admin panel that meant re-pulling orders every time a tab regained
// focus. Mutations still invalidate explicitly, so freshness is unaffected.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const GlobalAppEffects = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (isAdminRoute) {
    return null;
  }

  return (
    <>
      <FaviconLoader />
      <SocialChatWidget />
      <FacebookPixelTracker />
      <GoogleAnalyticsTracker />
      <TikTokPixelTracker />
    </>
  );
};

// Components animate with `m` rather than `motion`, so framer-motion's feature set
// is not part of the entry bundle — it is fetched once, in parallel, on first paint.
// `domMax` rather than `domAnimation` because the cart drawer uses layout animation.
const loadMotionFeatures = () => import('framer-motion').then((mod) => mod.domMax);

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LazyMotion features={loadMotionFeatures}>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <GlobalAppEffects />
            <CartDrawer />
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Main Pages */}
              <Route path="/" element={<FashionHomePage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/product/:slug" element={<ProductDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/my-account" element={<MyAccountPage />} />
              <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              
              {/* Landing Pages */}
              <Route path="/step/:slug" element={<ProductLandingPage />} />
              <Route path="/lp/:slug" element={<LandingPage />} />
              <Route path="/cotton-tarsel" element={<CottonTarselLandingPage />} />
               <Route path="/cotton-tarsel-collection" element={<CottonTarselLandingPage />} />
              <Route path="/digital-tarsel" element={<DigitalTarselLandingPage />} />
               <Route path="/digital-tarsel-collection" element={<DigitalTarselLandingPage />} />
              <Route path="/reyon-cotton" element={<ReyonCottonLandingPage />} />
              <Route path="/reyon-cotton-collection" element={<ReyonCottonLandingPage />} />
              
              {/* Admin Routes */}
              <Route path="/admin" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
              <Route path="/admin/reports" element={<AdminLayout><AdminReports /></AdminLayout>} />
              <Route path="/admin/products" element={<AdminLayout><AdminProducts /></AdminLayout>} />
              <Route path="/admin/wholesale-prices" element={<AdminLayout><AdminWholesalePrices /></AdminLayout>} />
              <Route path="/admin/categories" element={<AdminLayout><AdminCategories /></AdminLayout>} />
              <Route path="/admin/orders" element={<AdminLayout><AdminOrders /></AdminLayout>} />
              <Route path="/admin/incomplete-orders" element={<AdminLayout><AdminIncompleteOrders /></AdminLayout>} />
              <Route path="/admin/order-protection" element={<AdminOrderProtection />} />
              <Route path="/admin/contact-submissions" element={<AdminLayout><AdminContactSubmissions /></AdminLayout>} />
              <Route path="/admin/landing-pages" element={<AdminLayout><AdminLandingPages /></AdminLayout>} />
              <Route path="/admin/landing-pages/:id" element={<AdminLayout><AdminLandingPageEditor /></AdminLayout>} />
              <Route path="/admin/courier-history" element={<AdminLayout><AdminCourierHistory /></AdminLayout>} />
              <Route path="/admin/courier-settings" element={<AdminLayout><AdminCourierSettings /></AdminLayout>} />
              <Route path="/admin/users" element={<AdminLayout><AdminUsers /></AdminLayout>} />
              <Route path="/admin/inventory" element={<AdminLayout><AdminInventory /></AdminLayout>} />
              <Route path="/admin/banners" element={<AdminLayout><AdminBanners /></AdminLayout>} />
              <Route path="/admin/marketing" element={<AdminLayout><AdminMarketing /></AdminLayout>} />
              <Route path="/admin/sms" element={<AdminLayout><AdminSMS /></AdminLayout>} />
              <Route path="/admin/social-media" element={<AdminLayout><AdminSocialMedia /></AdminLayout>} />
              <Route path="/admin/shop-settings" element={<AdminLayout><AdminShopSettings /></AdminLayout>} />
              <Route path="/admin/site-settings" element={<AdminLayout><AdminSiteSettings /></AdminLayout>} />
              <Route path="/admin/home-page-edit" element={<AdminLayout><AdminHomePageEdit /></AdminLayout>} />
              <Route path="/admin/landing-video-settings" element={<AdminLandingVideoSettings />} />
              

              {/* Catch all - redirect to main page */}
              <Route path="*" element={<FashionHomePage />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
        </LazyMotion>
      </AuthProvider>
    </QueryClientProvider>
  </Provider>
);

export default App;
