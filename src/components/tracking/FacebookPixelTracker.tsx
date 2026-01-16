import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useFacebookPixel } from '@/hooks/useFacebookPixel';
import { useServerTracking } from '@/hooks/useServerTracking';

export function FacebookPixelTracker() {
  const location = useLocation();
  const { trackPageView: trackBrowserPageView, isEnabled, isReady, generateEventId } = useFacebookPixel();
  const { trackPageView: trackServerPageView } = useServerTracking();
  const lastTrackedPath = useRef<string>('');
  const hasTrackedInitial = useRef<boolean>(false);

  useEffect(() => {
    // Track page view when:
    // 1. Pixel is enabled and ready
    // 2. AND either path has changed OR we haven't tracked the initial page yet
    if (isEnabled && isReady) {
      const shouldTrack = location.pathname !== lastTrackedPath.current || !hasTrackedInitial.current;
      
      if (shouldTrack) {
        console.log('FacebookPixelTracker: Tracking page view for', location.pathname, '(initial:', !hasTrackedInitial.current, ')');
        
        // Generate a shared event ID for deduplication between browser pixel and CAPI
        const eventId = generateEventId('PageView');
        
        // Track via browser pixel with event ID
        trackBrowserPageView(eventId);
        
        // Track via server-side Conversions API with the same event ID
        // This ensures events are properly deduplicated by Meta
        trackServerPageView(undefined, eventId || undefined).then((result) => {
          console.log('FacebookPixelTracker: Server-side CAPI result:', result.facebook);
        }).catch((err) => {
          console.error('FacebookPixelTracker: Server-side CAPI error:', err);
        });
        
        lastTrackedPath.current = location.pathname;
        hasTrackedInitial.current = true;
      }
    }
  }, [location.pathname, isEnabled, isReady, trackBrowserPageView, trackServerPageView, generateEventId]);

  return null;
}
