import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface SocialMediaSettings {
  messenger_enabled: boolean;
  messenger_page_id: string;
  whatsapp_enabled: boolean;
  whatsapp_number: string;
}

const SocialChatWidget = () => {
  const location = useLocation();
  
  // Hide on landing pages
  const isLandingPage =
    location.pathname.startsWith("/lp/") ||
    location.pathname.startsWith("/l/") ||
    location.pathname.startsWith("/landing/");
  
  if (isLandingPage) return null;
  const { data: settings } = useQuery({
    queryKey: ["social-chat-settings"],
    queryFn: async () => {
      const keys = ["messenger_enabled", "messenger_page_id", "whatsapp_enabled", "whatsapp_number"];
      const { data, error } = await supabase
        .from("admin_settings")
        .select("key, value")
        .in("key", keys);

      if (error) throw error;

      const result: SocialMediaSettings = {
        messenger_enabled: false,
        messenger_page_id: "",
        whatsapp_enabled: false,
        whatsapp_number: "",
      };

      data?.forEach((item) => {
        if (item.key === "messenger_enabled") result.messenger_enabled = item.value === "true";
        if (item.key === "messenger_page_id") result.messenger_page_id = item.value;
        if (item.key === "whatsapp_enabled") result.whatsapp_enabled = item.value === "true";
        if (item.key === "whatsapp_number") result.whatsapp_number = item.value;
      });

      return result;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const hasAnyEnabled =
    (settings?.messenger_enabled && settings?.messenger_page_id) ||
    (settings?.whatsapp_enabled && settings?.whatsapp_number);

  if (!hasAnyEnabled) return null;

  const handleWhatsAppClick = () => {
    if (settings?.whatsapp_number) {
      window.open(`https://wa.me/${settings.whatsapp_number}`, "_blank");
    }
  };

  const handleMessengerClick = () => {
    if (settings?.messenger_page_id) {
      const link = settings.messenger_page_id.trim();
      // Add https:// if not present
      const url = link.startsWith("http") ? link : `https://${link}`;
      window.open(url, "_blank");
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {settings?.whatsapp_enabled && settings?.whatsapp_number && (
        <button
          onClick={handleWhatsAppClick}
          className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform hover:bg-green-600"
          aria-label="Chat on WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-white fill-current">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </button>
      )}
      {settings?.messenger_enabled && settings?.messenger_page_id && (
        <button
          onClick={handleMessengerClick}
          className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
          aria-label="Chat on Messenger"
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-white fill-current">
            <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.13.26.35.27.57l.05 1.78c.02.59.61.98 1.17.78l1.99-.8c.17-.07.36-.08.53-.04.9.24 1.87.37 2.85.37 5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2zm5.89 7.65l-2.83 4.47c-.44.7-1.36.89-2.03.42l-2.25-1.68c-.2-.15-.47-.15-.66 0l-3.04 2.3c-.4.31-.94-.15-.67-.58l2.83-4.47c.44-.7 1.36-.89 2.03-.42l2.25 1.68c.2.15.47.15.66 0l3.04-2.3c.4-.31.94.15.67.58z"/>
          </svg>
        </button>
      )}
    </div>
  );
};

export default SocialChatWidget;
