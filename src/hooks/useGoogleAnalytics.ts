import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

interface GAConfig {
  measurementId: string;
  gtmId: string;
  gaEnabled: boolean;
  gtmEnabled: boolean;
}

interface ProductItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity?: number;
  item_category?: string;
}

/**
 * Hook for Google Analytics 4 and Google Tag Manager tracking
 */
export const useGoogleAnalytics = () => {
  const configRef = useRef<GAConfig | null>(null);
  const initializedRef = useRef(false);

  // Load settings from database
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .from('admin_settings')
          .select('key, value')
          .in('key', ['ga_measurement_id', 'gtm_id', 'ga_enabled', 'gtm_enabled']);

        if (data) {
          const config: GAConfig = {
            measurementId: '',
            gtmId: '',
            gaEnabled: false,
            gtmEnabled: false,
          };

          data.forEach((setting) => {
            switch (setting.key) {
              case 'ga_measurement_id':
                config.measurementId = setting.value;
                break;
              case 'gtm_id':
                config.gtmId = setting.value;
                break;
              case 'ga_enabled':
                config.gaEnabled = setting.value === 'true';
                break;
              case 'gtm_enabled':
                config.gtmEnabled = setting.value === 'true';
                break;
            }
          });

          configRef.current = config;
          initializeTracking(config);
        }
      } catch (error) {
        console.error('[GA] Failed to load settings:', error);
      }
    };

    loadSettings();
  }, []);

  // Initialize GA4 and/or GTM
  const initializeTracking = (config: GAConfig) => {
    if (initializedRef.current) return;

    // Initialize GTM if enabled
    if (config.gtmEnabled && config.gtmId) {
      initializeGTM(config.gtmId);
    }

    // Initialize GA4 if enabled (and GTM is not, to avoid double tracking)
    if (config.gaEnabled && config.measurementId && !config.gtmEnabled) {
      initializeGA4(config.measurementId);
    }

    initializedRef.current = true;
  };

  // Initialize Google Tag Manager
  const initializeGTM = (gtmId: string) => {
    if (typeof window === 'undefined') return;
    if (document.querySelector(`script[src*="gtm.js?id=${gtmId}"]`)) return;

    console.log('[GTM] Initializing:', gtmId);

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];

    // Add GTM script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
    document.head.appendChild(script);

    // Add GTM noscript iframe
    const noscript = document.createElement('noscript');
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`;
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    noscript.appendChild(iframe);
    document.body.insertBefore(noscript, document.body.firstChild);

    // Push GTM start event
    window.dataLayer.push({
      'gtm.start': new Date().getTime(),
      event: 'gtm.js',
    });
  };

  // Initialize GA4 directly (without GTM)
  const initializeGA4 = (measurementId: string) => {
    if (typeof window === 'undefined') return;
    if (document.querySelector(`script[src*="gtag/js?id=${measurementId}"]`)) return;

    console.log('[GA4] Initializing:', measurementId);

    // Load gtag.js
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    // Initialize gtag
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: true,
    });
  };

  // Get client ID for server-side tracking
  const getClientId = useCallback((): string | null => {
    try {
      // Try to get from GA cookie
      const match = document.cookie.match(/_ga=([^;]+)/);
      if (match) {
        // _ga cookie format: GA1.2.123456789.1234567890
        const parts = match[1].split('.');
        if (parts.length >= 4) {
          return `${parts[2]}.${parts[3]}`;
        }
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Get session ID for server-side tracking
  const getSessionId = useCallback((): string | null => {
    try {
      const config = configRef.current;
      if (!config?.measurementId) return null;
      
      // Session ID cookie format: _ga_<MEASUREMENT_ID>=GS1.1.<session_id>.<session_number>...
      const measurementSuffix = config.measurementId.replace('G-', '');
      const match = document.cookie.match(new RegExp(`_ga_${measurementSuffix}=([^;]+)`));
      if (match) {
        const parts = match[1].split('.');
        if (parts.length >= 3) {
          return parts[2];
        }
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Track page view
  const trackPageView = useCallback((pagePath?: string, pageTitle?: string) => {
    if (typeof window === 'undefined') return;
    
    const config = configRef.current;
    if (!config?.gaEnabled && !config?.gtmEnabled) return;

    if (config.gtmEnabled) {
      window.dataLayer?.push({
        event: 'page_view',
        page_path: pagePath || window.location.pathname,
        page_title: pageTitle || document.title,
      });
    } else if (window.gtag) {
      window.gtag('event', 'page_view', {
        page_path: pagePath || window.location.pathname,
        page_title: pageTitle || document.title,
      });
    }
  }, []);

  // Track view item (product view)
  const trackViewItem = useCallback((item: ProductItem) => {
    if (typeof window === 'undefined') return;

    const config = configRef.current;
    if (!config?.gaEnabled && !config?.gtmEnabled) return;

    const eventData = {
      currency: 'BDT',
      value: item.price,
      items: [item],
    };

    if (config.gtmEnabled) {
      window.dataLayer?.push({
        event: 'view_item',
        ecommerce: eventData,
      });
    } else if (window.gtag) {
      window.gtag('event', 'view_item', eventData);
    }
  }, []);

  // Track add to cart
  const trackAddToCart = useCallback((item: ProductItem) => {
    if (typeof window === 'undefined') return;

    const config = configRef.current;
    if (!config?.gaEnabled && !config?.gtmEnabled) return;

    const eventData = {
      currency: 'BDT',
      value: item.price * (item.quantity || 1),
      items: [{ ...item, quantity: item.quantity || 1 }],
    };

    if (config.gtmEnabled) {
      window.dataLayer?.push({
        event: 'add_to_cart',
        ecommerce: eventData,
      });
    } else if (window.gtag) {
      window.gtag('event', 'add_to_cart', eventData);
    }
  }, []);

  // Track begin checkout
  const trackBeginCheckout = useCallback((items: ProductItem[], value: number) => {
    if (typeof window === 'undefined') return;

    const config = configRef.current;
    if (!config?.gaEnabled && !config?.gtmEnabled) return;

    const eventData = {
      currency: 'BDT',
      value,
      items,
    };

    if (config.gtmEnabled) {
      window.dataLayer?.push({
        event: 'begin_checkout',
        ecommerce: eventData,
      });
    } else if (window.gtag) {
      window.gtag('event', 'begin_checkout', eventData);
    }
  }, []);

  // Track purchase
  const trackPurchase = useCallback((params: {
    transactionId: string;
    value: number;
    items: ProductItem[];
    shipping?: number;
    tax?: number;
  }) => {
    if (typeof window === 'undefined') return;

    const config = configRef.current;
    if (!config?.gaEnabled && !config?.gtmEnabled) return;

    const eventData = {
      transaction_id: params.transactionId,
      currency: 'BDT',
      value: params.value,
      shipping: params.shipping || 0,
      tax: params.tax || 0,
      items: params.items,
    };

    if (config.gtmEnabled) {
      window.dataLayer?.push({
        event: 'purchase',
        ecommerce: eventData,
      });
    } else if (window.gtag) {
      window.gtag('event', 'purchase', eventData);
    }
  }, []);

  // Generic event tracking
  const trackEvent = useCallback((eventName: string, eventParams?: Record<string, unknown>) => {
    if (typeof window === 'undefined') return;

    const config = configRef.current;
    if (!config?.gaEnabled && !config?.gtmEnabled) return;

    if (config.gtmEnabled) {
      window.dataLayer?.push({
        event: eventName,
        ...eventParams,
      });
    } else if (window.gtag) {
      window.gtag('event', eventName, eventParams);
    }
  }, []);

  return {
    trackPageView,
    trackViewItem,
    trackAddToCart,
    trackBeginCheckout,
    trackPurchase,
    trackEvent,
    getClientId,
    getSessionId,
  };
};
