import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useGoogleAnalytics } from '@/hooks/useGoogleAnalytics';

/**
 * Component that initializes Google Analytics/GTM and tracks page views
 * Place this inside the BrowserRouter in App.tsx
 * Excludes admin routes from tracking
 */
const GoogleAnalyticsTracker = () => {
  const location = useLocation();
  const { trackPageView } = useGoogleAnalytics();

  // Track page views on route changes, excluding admin routes
  useEffect(() => {
    // Skip tracking for admin routes
    if (location.pathname.startsWith('/admin')) {
      return;
    }
    trackPageView(location.pathname);
  }, [location.pathname, trackPageView]);

  return null;
};

export default GoogleAnalyticsTracker;
