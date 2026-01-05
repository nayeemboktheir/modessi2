import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTikTokPixel } from '@/hooks/useTikTokPixel';

export function TikTokPixelTracker() {
  const location = useLocation();
  const { trackPageView, isEnabled, isReady } = useTikTokPixel();
  const lastTrackedPath = useRef<string>('');

  useEffect(() => {
    // Only track if enabled, ready, and path has changed
    if (isEnabled && isReady && location.pathname !== lastTrackedPath.current) {
      console.log('TikTokPixelTracker: Tracking page view for', location.pathname);
      trackPageView();
      lastTrackedPath.current = location.pathname;
    }
  }, [location.pathname, isEnabled, isReady, trackPageView]);

  return null;
}
