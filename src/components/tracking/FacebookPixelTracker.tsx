import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useFacebookPixel } from '@/hooks/useFacebookPixel';

export function FacebookPixelTracker() {
  const location = useLocation();
  const { trackPageView, isEnabled, isReady } = useFacebookPixel();
  const lastTrackedPath = useRef<string>('');

  useEffect(() => {
    // Only track if enabled, ready, and path has changed
    if (isEnabled && isReady && location.pathname !== lastTrackedPath.current) {
      console.log('FacebookPixelTracker: Tracking page view for', location.pathname);
      trackPageView();
      lastTrackedPath.current = location.pathname;
    }
  }, [location.pathname, isEnabled, isReady, trackPageView]);

  return null;
}
