import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTikTokPixel } from '@/hooks/useTikTokPixel';

export function TikTokPixelTracker() {
  const location = useLocation();
  const { trackPageView, isEnabled, isReady } = useTikTokPixel();
  const lastTrackedPath = useRef<string>('');
  const hasTrackedInitial = useRef<boolean>(false);

  useEffect(() => {
    // Skip tracking for admin routes
    if (location.pathname.startsWith('/admin')) {
      return;
    }
    
    // Track page view when:
    // 1. Pixel is enabled and ready
    // 2. AND either path has changed OR we haven't tracked the initial page yet
    if (isEnabled && isReady) {
      const shouldTrack = location.pathname !== lastTrackedPath.current || !hasTrackedInitial.current;
      
      if (shouldTrack) {
        console.log('TikTokPixelTracker: Tracking page view for', location.pathname, '(initial:', !hasTrackedInitial.current, ')');
        trackPageView();
        lastTrackedPath.current = location.pathname;
        hasTrackedInitial.current = true;
      }
    }
  }, [location.pathname, isEnabled, isReady, trackPageView]);

  return null;
}
