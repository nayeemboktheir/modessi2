import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useGoogleAnalytics } from '@/hooks/useGoogleAnalytics';

/**
 * Component that initializes Google Analytics/GTM and tracks page views
 * Place this inside the BrowserRouter in App.tsx
 */
const GoogleAnalyticsTracker = () => {
  const location = useLocation();
  const { trackPageView } = useGoogleAnalytics();

  // Track page views on route changes
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname, trackPageView]);

  return null;
};

export default GoogleAnalyticsTracker;
