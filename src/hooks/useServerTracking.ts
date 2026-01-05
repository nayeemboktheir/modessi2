import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

interface CustomData {
  currency?: string;
  value?: number;
  content_ids?: string[];
  content_type?: string;
  num_items?: number;
  order_id?: string;
}

interface TrackEventParams {
  eventName: string;
  userData?: UserData;
  customData?: CustomData;
}

interface ProductItem {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
}

// Get ttclid from storage (captured by client-side pixel)
const getTtclid = (): string | null => {
  try {
    return sessionStorage.getItem('_ttclid');
  } catch {
    return null;
  }
};

// Get TikTok external ID
const getTikTokExternalId = (): string => {
  try {
    return localStorage.getItem('_tt_external_id') || '';
  } catch {
    return '';
  }
};

// Get fbclid from storage (captured by client-side pixel)
const getFbclid = (): string | null => {
  try {
    return sessionStorage.getItem('_fbclid');
  } catch {
    return null;
  }
};

// Get fbp cookie value
const getFbp = (): string | null => {
  try {
    const match = document.cookie.match(/_fbp=([^;]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

// Get fbc cookie value (or construct from fbclid)
const getFbc = (): string | null => {
  try {
    // First check for existing _fbc cookie
    const match = document.cookie.match(/_fbc=([^;]+)/);
    if (match) return match[1];
    
    // If no _fbc but we have fbclid, construct it
    const fbclid = getFbclid();
    if (fbclid) {
      const timestamp = Math.floor(Date.now() / 1000);
      return `fb.1.${timestamp}.${fbclid}`;
    }
    
    return null;
  } catch {
    return null;
  }
};

// Get external ID for deduplication
const getExternalId = (): string => {
  try {
    return localStorage.getItem('_fb_external_id') || '';
  } catch {
    return '';
  }
};

// Get GA client ID from cookie
const getGAClientId = (): string | null => {
  try {
    const match = document.cookie.match(/_ga=([^;]+)/);
    if (match) {
      const parts = match[1].split('.');
      if (parts.length >= 4) {
        return `${parts[2]}.${parts[3]}`;
      }
    }
    return null;
  } catch {
    return null;
  }
};

// Get GA session ID from cookie
const getGASessionId = (): string | null => {
  try {
    // Try to find any _ga_ cookie for session
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const trimmed = cookie.trim();
      if (trimmed.startsWith('_ga_')) {
        const value = trimmed.split('=')[1];
        if (value) {
          const parts = value.split('.');
          if (parts.length >= 3) {
            return parts[2];
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Hook for server-side tracking via Meta Conversions API (CAPI) and Google Analytics Measurement Protocol
 * This sends events directly from the server for better accuracy and to bypass ad blockers.
 */
export const useServerTracking = () => {
  
  /**
   * Send an event to Facebook Conversions API via edge function
   */
  const trackFacebookEvent = useCallback(async ({
    eventName,
    userData = {},
    customData = {},
  }: TrackEventParams): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log(`[CAPI] Sending ${eventName} event to server...`);
      
      const payload = {
        event_name: eventName,
        user_data: {
          email: userData.email,
          phone: userData.phone,
          first_name: userData.firstName,
          last_name: userData.lastName,
          external_id: getExternalId(),
          fbc: getFbc(),
          fbp: getFbp(),
        },
        custom_data: customData,
        event_source_url: window.location.href,
      };
      
      const { data, error } = await supabase.functions.invoke('facebook-capi', {
        body: payload,
      });
      
      if (error) {
        console.error('[CAPI] Error:', error);
        return { success: false, error: error.message };
      }
      
      console.log('[CAPI] Response:', data);
      return { success: data?.success ?? false, error: data?.error };
    } catch (err) {
      console.error('[CAPI] Exception:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, []);

  /**
   * Send an event to Google Analytics via Measurement Protocol edge function
   */
  const trackGoogleEvent = useCallback(async (params: {
    eventName: string;
    eventParams?: Record<string, unknown>;
    items?: ProductItem[];
    value?: number;
    transactionId?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log(`[GA Server] Sending ${params.eventName} event...`);
      
      const payload = {
        event_name: params.eventName,
        client_id: getGAClientId(),
        session_id: getGASessionId(),
        params: {
          ...params.eventParams,
          currency: 'BDT',
          value: params.value,
          transaction_id: params.transactionId,
          items: params.items,
          page_location: window.location.href,
          page_title: document.title,
        },
      };
      
      const { data, error } = await supabase.functions.invoke('google-analytics', {
        body: payload,
      });
      
      if (error) {
        console.error('[GA Server] Error:', error);
        return { success: false, error: error.message };
      }
      
      console.log('[GA Server] Response:', data);
      return { success: data?.success ?? false, error: data?.error };
    } catch (err) {
      console.error('[GA Server] Exception:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, []);

  /**
   * Send an event to TikTok Events API via edge function
   */
  const trackTikTokEvent = useCallback(async ({
    eventName,
    userData = {},
    customData = {},
  }: TrackEventParams): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log(`[TikTok Server] Sending ${eventName} event...`);
      
      const payload = {
        event_name: eventName,
        user_data: {
          email: userData.email,
          phone: userData.phone,
          external_id: getTikTokExternalId(),
          ttclid: getTtclid(),
        },
        custom_data: customData,
        event_source_url: window.location.href,
      };
      
      const { data, error } = await supabase.functions.invoke('tiktok-events-api', {
        body: payload,
      });
      
      if (error) {
        console.error('[TikTok Server] Error:', error);
        return { success: false, error: error.message };
      }
      
      console.log('[TikTok Server] Response:', data);
      return { success: data?.success ?? false, error: data?.error };
    } catch (err) {
      console.error('[TikTok Server] Exception:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, []);

  /**
   * Track Facebook, Google, and TikTok events simultaneously
   */
  const trackServerEvent = useCallback(async ({
    eventName,
    userData = {},
    customData = {},
  }: TrackEventParams): Promise<{ facebook: { success: boolean; error?: string }; google: { success: boolean; error?: string }; tiktok: { success: boolean; error?: string } }> => {
    // Map FB event names to GA4 event names
    const gaEventMap: Record<string, string> = {
      'PageView': 'page_view',
      'ViewContent': 'view_item',
      'AddToCart': 'add_to_cart',
      'InitiateCheckout': 'begin_checkout',
      'AddPaymentInfo': 'add_payment_info',
      'Purchase': 'purchase',
      'Lead': 'generate_lead',
    };

    // Convert content_ids to items for GA4
    const items: ProductItem[] = customData.content_ids?.map(id => ({
      item_id: id,
      item_name: id,
      price: customData.value,
      quantity: 1,
    })) || [];

    const [fbResult, gaResult, ttResult] = await Promise.all([
      trackFacebookEvent({ eventName, userData, customData }),
      trackGoogleEvent({
        eventName: gaEventMap[eventName] || eventName.toLowerCase(),
        value: customData.value,
        transactionId: customData.order_id,
        items,
      }),
      trackTikTokEvent({ eventName, userData, customData }),
    ]);

    return { facebook: fbResult, google: gaResult, tiktok: ttResult };
  }, [trackFacebookEvent, trackGoogleEvent, trackTikTokEvent]);
  
  /**
   * Track a page view event
   */
  const trackPageView = useCallback(async (userData?: UserData) => {
    return trackServerEvent({
      eventName: 'PageView',
      userData,
    });
  }, [trackServerEvent]);
  
  /**
   * Track when a user views a product
   */
  const trackViewContent = useCallback(async (params: {
    contentId: string;
    contentName: string;
    value: number;
    currency?: string;
    userData?: UserData;
  }) => {
    return trackServerEvent({
      eventName: 'ViewContent',
      userData: params.userData,
      customData: {
        content_ids: [params.contentId],
        content_type: 'product',
        value: params.value,
        currency: params.currency || 'BDT',
      },
    });
  }, [trackServerEvent]);
  
  /**
   * Track when a user adds item to cart
   */
  const trackAddToCart = useCallback(async (params: {
    contentId: string;
    contentName: string;
    value: number;
    quantity?: number;
    currency?: string;
    userData?: UserData;
  }) => {
    return trackServerEvent({
      eventName: 'AddToCart',
      userData: params.userData,
      customData: {
        content_ids: [params.contentId],
        content_type: 'product',
        value: params.value,
        num_items: params.quantity || 1,
        currency: params.currency || 'BDT',
      },
    });
  }, [trackServerEvent]);
  
  /**
   * Track when a user initiates checkout
   */
  const trackInitiateCheckout = useCallback(async (params: {
    contentIds: string[];
    value: number;
    numItems: number;
    currency?: string;
    userData?: UserData;
  }) => {
    return trackServerEvent({
      eventName: 'InitiateCheckout',
      userData: params.userData,
      customData: {
        content_ids: params.contentIds,
        content_type: 'product',
        value: params.value,
        num_items: params.numItems,
        currency: params.currency || 'BDT',
      },
    });
  }, [trackServerEvent]);
  
  /**
   * Track when a user adds payment info
   */
  const trackAddPaymentInfo = useCallback(async (params: {
    contentIds: string[];
    value: number;
    currency?: string;
    userData: UserData;
  }) => {
    return trackServerEvent({
      eventName: 'AddPaymentInfo',
      userData: params.userData,
      customData: {
        content_ids: params.contentIds,
        content_type: 'product',
        value: params.value,
        currency: params.currency || 'BDT',
      },
    });
  }, [trackServerEvent]);
  
  /**
   * Track a completed purchase - MOST IMPORTANT EVENT
   */
  const trackPurchase = useCallback(async (params: {
    orderId: string;
    contentIds: string[];
    value: number;
    numItems: number;
    currency?: string;
    userData: UserData;
  }) => {
    return trackServerEvent({
      eventName: 'Purchase',
      userData: params.userData,
      customData: {
        order_id: params.orderId,
        content_ids: params.contentIds,
        content_type: 'product',
        value: params.value,
        num_items: params.numItems,
        currency: params.currency || 'BDT',
      },
    });
  }, [trackServerEvent]);
  
  /**
   * Track a lead (contact form, newsletter signup, etc.)
   */
  const trackLead = useCallback(async (params: {
    userData: UserData;
    value?: number;
    currency?: string;
  }) => {
    return trackServerEvent({
      eventName: 'Lead',
      userData: params.userData,
      customData: params.value ? {
        value: params.value,
        currency: params.currency || 'BDT',
      } : undefined,
    });
  }, [trackServerEvent]);
  
  /**
   * Track a custom event
   */
  const trackCustomEvent = useCallback(async (params: {
    eventName: string;
    userData?: UserData;
    customData?: CustomData;
  }) => {
    return trackServerEvent(params);
  }, [trackServerEvent]);
  
  return {
    trackServerEvent,
    trackFacebookEvent,
    trackGoogleEvent,
    trackTikTokEvent,
    trackPageView,
    trackViewContent,
    trackAddToCart,
    trackInitiateCheckout,
    trackAddPaymentInfo,
    trackPurchase,
    trackLead,
    trackCustomEvent,
  };
};
