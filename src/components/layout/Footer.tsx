import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Facebook, 
  Instagram, 
  Youtube,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Footer = () => {
  // Fetch site settings
  const { data: siteSettings } = useQuery({
    queryKey: ['footer-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['site_name', 'site_logo', 'header_phone', 'whatsapp_number', 'call_number']);
      
      if (error) throw error;
      
      const settingsMap: Record<string, string> = {};
      data?.forEach(item => {
        settingsMap[item.key] = item.value;
      });
      
      return settingsMap;
    },
    staleTime: 5 * 60 * 1000,
  });

  const siteName = siteSettings?.site_name || 'খেজুর বাজার';
  const siteLogo = siteSettings?.site_logo;
  const phoneNumber = siteSettings?.header_phone || siteSettings?.call_number || '+880 1234-567890';

  return (
    <footer className="bg-foreground text-primary-foreground">
      {/* Main Footer */}
      <div className="container-custom py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {siteLogo && (
                <img 
                  src={siteLogo} 
                  alt={siteName} 
                  className="h-10 w-auto"
                />
              )}
              <h2 className="text-2xl font-display font-bold">{siteName}</h2>
            </div>
            <p className="text-primary-foreground/70 leading-relaxed">
              প্রিমিয়াম খেজুরের অনলাইন শপ - খাঁটি খেজুর পৌঁছে দিই প্রতিটি ঘরে।
            </p>
            <div className="flex gap-4">
              <a href="#" className="h-10 w-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="h-10 w-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="h-10 w-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary transition-colors">
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">দ্রুত লিংক</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/products" className="text-primary-foreground/70 hover:text-primary transition-colors">
                  সকল পণ্য
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-primary-foreground/70 hover:text-primary transition-colors">
                  আমাদের সম্পর্কে
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-primary-foreground/70 hover:text-primary transition-colors">
                  যোগাযোগ
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="text-lg font-semibold mb-4">কাস্টমার সার্ভিস</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/contact" className="text-primary-foreground/70 hover:text-primary transition-colors">
                  অর্ডার ট্র্যাক করুন
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-primary-foreground/70 hover:text-primary transition-colors">
                  রিটার্ন ও রিফান্ড
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-primary-foreground/70 hover:text-primary transition-colors">
                  সাহায্য
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">যোগাযোগ করুন</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-primary-foreground/70">
                <Phone className="h-5 w-5 text-primary" />
                <a href={`tel:${phoneNumber.replace(/\s/g, '')}`} className="hover:text-primary transition-colors">
                  {phoneNumber}
                </a>
              </li>
              <li className="flex items-center gap-3 text-primary-foreground/70">
                <Mail className="h-5 w-5 text-primary" />
                <span>info@khejurerbajar.com</span>
              </li>
              <li className="flex items-start gap-3 text-primary-foreground/70">
                <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
                <span>ঢাকা, বাংলাদেশ</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-primary-foreground/10">
        <div className="container-custom py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-primary-foreground/60 text-sm">
              © {new Date().getFullYear()} {siteName}। সর্বস্বত্ব সংরক্ষিত।
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/contact" className="text-primary-foreground/60 hover:text-primary transition-colors">
                গোপনীয়তা নীতি
              </Link>
              <Link to="/contact" className="text-primary-foreground/60 hover:text-primary transition-colors">
                শর্তাবলী
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
