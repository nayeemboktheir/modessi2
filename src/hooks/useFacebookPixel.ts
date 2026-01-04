import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    fbq: ((...args: any[]) => void) & { 
      push?: (...args: any[]) => void;
      loaded?: boolean;
      version?: string;
      queue?: any[];
      callMethod?: (...args: any[]) => void;
    };
    _fbq: any;
  }
}

interface FacebookPixelConfig {
  pixelId: string;
  enabled: boolean;
}

interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  externalId?: string;
}

let pixelConfig: FacebookPixelConfig | null = null;
let isPixelLoading = false;
let pixelLoadPromise: Promise<void> | null = null;

// Capture and store fbclid from URL for better event matching
const captureFbclid = (): string | null => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const fbclid = urlParams.get('fbclid');
    
    if (fbclid) {
      // Store in sessionStorage for use across page navigations
      sessionStorage.setItem('_fbclid', fbclid);
      console.log('Meta ClickID captured:', fbclid.substring(0, 20) + '...');
      return fbclid;
    }
    
    // Return stored fbclid if available
    return sessionStorage.getItem('_fbclid');
  } catch (e) {
    console.error('Error capturing fbclid:', e);
    return null;
  }
};

// Generate or retrieve a consistent external ID for the user
const getExternalId = (): string => {
  try {
    let externalId = localStorage.getItem('_fb_external_id');
    if (!externalId) {
      externalId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('_fb_external_id', externalId);
    }
    return externalId;
  } catch (e) {
    return 'user_' + Date.now();
  }
};

const loadPixelScript = (pixelId: string, userData?: UserData): Promise<void> => {
  if (pixelLoadPromise) return pixelLoadPromise;

  isPixelLoading = true;

  // Capture fbclid on initial load
  captureFbclid();

  pixelLoadPromise = new Promise((resolve) => {
    console.log('Loading Meta Pixel script with Advanced Matching...');

    // Build advanced matching data
    const advancedMatchingData: Record<string, string> = {
      external_id: getExternalId(),
    };

    // Add user data if available
    if (userData?.email) advancedMatchingData.em = userData.email.toLowerCase().trim();
    if (userData?.phone) advancedMatchingData.ph = userData.phone.replace(/\D/g, '');
    if (userData?.firstName) advancedMatchingData.fn = userData.firstName.toLowerCase().trim();
    if (userData?.lastName) advancedMatchingData.ln = userData.lastName.toLowerCase().trim();

    // If fbq already exists, just (re)initialize with our pixel ID and advanced matching
    if (window.fbq && typeof window.fbq === 'function') {
      window.fbq('init', pixelId, advancedMatchingData);
      window.fbq('track', 'PageView');
      console.log('Meta Pixel initialized with Advanced Matching:', Object.keys(advancedMatchingData));
      isPixelLoading = false;
      resolve();
      return;
    }

    // Standard Facebook Pixel initialization
    (function (f: any, b: Document, e: string, v: string, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    // Initialize the pixel after script is ready with advanced matching
    const checkAndInit = () => {
      if (window.fbq && typeof window.fbq === 'function') {
        window.fbq('init', pixelId, advancedMatchingData);
        window.fbq('track', 'PageView');
        console.log('Meta Pixel initialized with Advanced Matching:', Object.keys(advancedMatchingData));
        isPixelLoading = false;
        resolve();
      } else {
        setTimeout(checkAndInit, 100);
      }
    };

    setTimeout(checkAndInit, 300);

    // Add noscript fallback
    const noscript = document.createElement('noscript');
    const img = document.createElement('img');
    img.height = 1;
    img.width = 1;
    img.style.display = 'none';
    img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
    noscript.appendChild(img);
    document.body.appendChild(noscript);
  });

  return pixelLoadPromise;
};

export const useFacebookPixel = () => {
  const [config, setConfig] = useState<FacebookPixelConfig | null>(pixelConfig);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Capture fbclid on every page load
    captureFbclid();

    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_settings')
          .select('key, value')
          .in('key', ['fb_pixel_id', 'fb_pixel_enabled']);

        if (error) {
          console.error('Failed to fetch pixel settings:', error);
          return;
        }

        let id = '';
        let enabled = false;

        data?.forEach((setting) => {
          if (setting.key === 'fb_pixel_id') id = setting.value;
          if (setting.key === 'fb_pixel_enabled') enabled = setting.value === 'true';
        });

        const newConfig = { pixelId: id, enabled: enabled && !!id };

        // Update cache + state every mount so admin changes take effect without stale config
        pixelConfig = newConfig;
        setConfig(newConfig);

        console.log('Meta Pixel config loaded:', { enabled: newConfig.enabled, hasPixelId: !!id });

        if (newConfig.enabled) {
          await loadPixelScript(newConfig.pixelId);
          setIsReady(true);
        } else {
          setIsReady(false);
        }
      } catch (error) {
        console.error('Failed to load Meta Pixel config:', error);
      }
    };

    loadConfig();
  }, []);

  // Update user data for better matching (call when user logs in or provides info)
  const setUserData = useCallback((userData: UserData) => {
    if (config?.enabled && window.fbq) {
      const advancedMatchingData: Record<string, string> = {
        external_id: userData.externalId || getExternalId(),
      };
      
      if (userData.email) advancedMatchingData.em = userData.email.toLowerCase().trim();
      if (userData.phone) advancedMatchingData.ph = userData.phone.replace(/\D/g, '');
      if (userData.firstName) advancedMatchingData.fn = userData.firstName.toLowerCase().trim();
      if (userData.lastName) advancedMatchingData.ln = userData.lastName.toLowerCase().trim();

      console.log('Updating Meta Pixel user data:', Object.keys(advancedMatchingData));
      window.fbq('init', config.pixelId, advancedMatchingData);
    }
  }, [config]);

  const trackPageView = useCallback(() => {
    if (config?.enabled && window.fbq) {
      console.log('Tracking PageView');
      window.fbq('track', 'PageView');
    }
  }, [config]);

  const trackViewContent = useCallback(
    (params: { content_ids: string[]; content_name: string; content_type: string; value: number; currency: string }) => {
      if (config?.enabled && window.fbq) {
        console.log('Tracking ViewContent:', params);
        window.fbq('track', 'ViewContent', params);
      }
    },
    [config]
  );

  const trackAddToCart = useCallback(
    (params: { content_ids: string[]; content_name: string; content_type: string; value: number; currency: string }) => {
      if (config?.enabled && window.fbq) {
        console.log('Tracking AddToCart:', params);
        window.fbq('track', 'AddToCart', params);
      }
    },
    [config]
  );

  const trackInitiateCheckout = useCallback(
    (params: { content_ids: string[]; num_items: number; value: number; currency: string }) => {
      if (config?.enabled && window.fbq) {
        console.log('Tracking InitiateCheckout:', params);
        window.fbq('track', 'InitiateCheckout', params);
      }
    },
    [config]
  );

  const trackPurchase = useCallback(
    (params: { 
      content_ids: string[]; 
      content_type: string; 
      value: number; 
      currency: string; 
      num_items: number;
      email?: string;
      phone?: string;
    }) => {
      if (config?.enabled && window.fbq) {
        // Update user data before purchase if provided
        if (params.email || params.phone) {
          setUserData({ email: params.email, phone: params.phone });
        }
        
        const { email, phone, ...trackParams } = params;
        console.log('Tracking Purchase:', trackParams);
        window.fbq('track', 'Purchase', trackParams);
      }
    },
    [config, setUserData]
  );

  return {
    isEnabled: config?.enabled ?? false,
    isReady,
    trackPageView,
    trackViewContent,
    trackAddToCart,
    trackInitiateCheckout,
    trackPurchase,
    setUserData,
  };
};
