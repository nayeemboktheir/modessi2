import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    ttq: {
      load: (pixelId: string) => void;
      page: () => void;
      track: (event: string, params?: Record<string, unknown>) => void;
      identify: (params: Record<string, unknown>) => void;
      instance: (pixelId: string) => {
        page: () => void;
        track: (event: string, params?: Record<string, unknown>) => void;
        identify: (params: Record<string, unknown>) => void;
      };
    };
    TiktokAnalyticsObject: string;
  }
}

interface TikTokPixelConfig {
  pixelId: string;
  enabled: boolean;
}

interface UserData {
  email?: string;
  phone?: string;
  externalId?: string;
}

let pixelConfig: TikTokPixelConfig | null = null;
let isPixelLoading = false;
let pixelLoadPromise: Promise<void> | null = null;

// Capture ttclid from URL for better event matching
const captureTtclid = (): string | null => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const ttclid = urlParams.get('ttclid');
    
    if (ttclid) {
      sessionStorage.setItem('_ttclid', ttclid);
      console.log('TikTok ClickID captured:', ttclid.substring(0, 20) + '...');
      return ttclid;
    }
    
    return sessionStorage.getItem('_ttclid');
  } catch (e) {
    console.error('Error capturing ttclid:', e);
    return null;
  }
};

// Generate or retrieve a consistent external ID
const getExternalId = (): string => {
  try {
    let externalId = localStorage.getItem('_tt_external_id');
    if (!externalId) {
      externalId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('_tt_external_id', externalId);
    }
    return externalId;
  } catch (e) {
    return 'user_' + Date.now();
  }
};

const loadPixelScript = (pixelId: string): Promise<void> => {
  if (pixelLoadPromise) return pixelLoadPromise;

  isPixelLoading = true;
  captureTtclid();

  pixelLoadPromise = new Promise((resolve) => {
    console.log('Loading TikTok Pixel script...');

    // Check if already loaded
    if (window.ttq) {
      window.ttq.load(pixelId);
      window.ttq.page();
      console.log('TikTok Pixel initialized');
      isPixelLoading = false;
      resolve();
      return;
    }

    // TikTok Pixel base code
    (function(w: Window, d: Document, t: string) {
      (w as any).TiktokAnalyticsObject = t;
      const ttq = (w as any)[t] = (w as any)[t] || [];
      ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
      ttq.setAndDefer = function(t: any, e: string) {
        t[e] = function() {
          t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      for (let i = 0; i < ttq.methods.length; i++) {
        ttq.setAndDefer(ttq, ttq.methods[i]);
      }
      ttq.instance = function(t: string) {
        const e = ttq._i[t] || [];
        for (let n = 0; n < ttq.methods.length; n++) {
          ttq.setAndDefer(e, ttq.methods[n]);
        }
        return e;
      };
      ttq.load = function(e: string, n?: Record<string, unknown>) {
        const i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
        ttq._i = ttq._i || {};
        ttq._i[e] = [];
        ttq._i[e]._u = i;
        ttq._t = ttq._t || {};
        ttq._t[e] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[e] = n || {};
        const o = d.createElement('script');
        o.type = 'text/javascript';
        o.async = true;
        o.src = i + '?sdkid=' + e + '&lib=' + t;
        const a = d.getElementsByTagName('script')[0];
        a.parentNode?.insertBefore(o, a);
      };
    })(window, document, 'ttq');

    // Initialize after script is ready
    const checkAndInit = () => {
      if (window.ttq && typeof window.ttq.load === 'function') {
        window.ttq.load(pixelId);
        window.ttq.page();
        console.log('TikTok Pixel initialized');
        isPixelLoading = false;
        resolve();
      } else {
        setTimeout(checkAndInit, 100);
      }
    };

    setTimeout(checkAndInit, 300);
  });

  return pixelLoadPromise;
};

export const useTikTokPixel = () => {
  const [config, setConfig] = useState<TikTokPixelConfig | null>(pixelConfig);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    captureTtclid();

    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_settings')
          .select('key, value')
          .in('key', ['tiktok_pixel_id', 'tiktok_pixel_enabled']);

        if (error) {
          console.error('Failed to fetch TikTok pixel settings:', error);
          return;
        }

        let id = '';
        let enabled = false;

        data?.forEach((setting) => {
          if (setting.key === 'tiktok_pixel_id') id = setting.value;
          if (setting.key === 'tiktok_pixel_enabled') enabled = setting.value === 'true';
        });

        const newConfig = { pixelId: id, enabled: enabled && !!id };
        pixelConfig = newConfig;
        setConfig(newConfig);

        console.log('TikTok Pixel config loaded:', { enabled: newConfig.enabled, hasPixelId: !!id });

        if (newConfig.enabled) {
          await loadPixelScript(newConfig.pixelId);
          setIsReady(true);
        } else {
          setIsReady(false);
        }
      } catch (error) {
        console.error('Failed to load TikTok Pixel config:', error);
      }
    };

    loadConfig();
  }, []);

  const setUserData = useCallback((userData: UserData) => {
    if (config?.enabled && window.ttq) {
      const identifyData: Record<string, string> = {};
      
      if (userData.email) identifyData.email = userData.email.toLowerCase().trim();
      if (userData.phone) identifyData.phone_number = userData.phone.replace(/\D/g, '');
      if (userData.externalId) identifyData.external_id = userData.externalId;

      console.log('Updating TikTok Pixel user data');
      window.ttq.identify(identifyData);
    }
  }, [config]);

  const trackPageView = useCallback(() => {
    if (config?.enabled && window.ttq) {
      console.log('TikTok: Tracking PageView');
      window.ttq.page();
    }
  }, [config]);

  const trackViewContent = useCallback(
    (params: { content_id: string; content_name: string; content_type?: string; value: number; currency: string }) => {
      if (config?.enabled && window.ttq) {
        console.log('TikTok: Tracking ViewContent', params);
        window.ttq.track('ViewContent', {
          contents: [{ content_id: params.content_id, content_name: params.content_name }],
          content_type: params.content_type || 'product',
          value: params.value,
          currency: params.currency,
        });
      }
    },
    [config]
  );

  const trackAddToCart = useCallback(
    (params: { content_id: string; content_name: string; quantity?: number; value: number; currency: string }) => {
      if (config?.enabled && window.ttq) {
        console.log('TikTok: Tracking AddToCart', params);
        window.ttq.track('AddToCart', {
          contents: [{ content_id: params.content_id, content_name: params.content_name, quantity: params.quantity || 1 }],
          content_type: 'product',
          value: params.value,
          currency: params.currency,
        });
      }
    },
    [config]
  );

  const trackInitiateCheckout = useCallback(
    (params: { content_ids: string[]; value: number; currency: string }) => {
      if (config?.enabled && window.ttq) {
        console.log('TikTok: Tracking InitiateCheckout', params);
        window.ttq.track('InitiateCheckout', {
          contents: params.content_ids.map(id => ({ content_id: id })),
          content_type: 'product',
          value: params.value,
          currency: params.currency,
        });
      }
    },
    [config]
  );

  const trackCompletePayment = useCallback(
    (params: { 
      content_ids: string[]; 
      value: number; 
      currency: string;
      quantity?: number;
      email?: string;
      phone?: string;
    }) => {
      if (config?.enabled && window.ttq) {
        // Update user data before purchase if provided
        if (params.email || params.phone) {
          setUserData({ email: params.email, phone: params.phone });
        }

        console.log('TikTok: Tracking CompletePayment', params);
        window.ttq.track('CompletePayment', {
          contents: params.content_ids.map(id => ({ content_id: id })),
          content_type: 'product',
          value: params.value,
          currency: params.currency,
          quantity: params.quantity || params.content_ids.length,
        });
      }
    },
    [config, setUserData]
  );

  const trackPlaceAnOrder = useCallback(
    (params: { content_ids: string[]; value: number; currency: string; quantity?: number }) => {
      if (config?.enabled && window.ttq) {
        console.log('TikTok: Tracking PlaceAnOrder', params);
        window.ttq.track('PlaceAnOrder', {
          contents: params.content_ids.map(id => ({ content_id: id })),
          content_type: 'product',
          value: params.value,
          currency: params.currency,
          quantity: params.quantity || params.content_ids.length,
        });
      }
    },
    [config]
  );

  return {
    isEnabled: config?.enabled ?? false,
    isReady,
    trackPageView,
    trackViewContent,
    trackAddToCart,
    trackInitiateCheckout,
    trackCompletePayment,
    trackPlaceAnOrder,
    setUserData,
    getExternalId,
    getTtclid: () => sessionStorage.getItem('_ttclid'),
  };
};
