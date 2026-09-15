import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import shopLogo from '@/assets/shop-logo.png';

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

  const siteName = 'Modessi';
  const siteLogo = shopLogo;

  return (
    <footer className="bg-[#1a1a2e] text-white">
      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {siteLogo ? (
                <img
                  loading="lazy"
                  decoding="async"
                  src={siteLogo} 
                  alt={siteName} 
                  className="h-10 w-auto"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center">
                  <span className="text-white text-lg">✦</span>
                </div>
              )}
              <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">
                {siteName}
              </h2>
            </div>
            <p className="text-gray-400 leading-relaxed text-sm">
              প্রিমিয়াম কোয়ালিটি টু পিস ও থ্রি পিস কালেকশন। 
              <span className="block text-pink-400 mt-1">আপনার স্টাইল, আপনার পছন্দ।</span>
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-5 text-white">কুইক লিংক</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/products" className="text-gray-400 hover:text-pink-400 transition-colors text-sm">
                  সব প্রোডাক্ট
                </Link>
              </li>
              <li>
                <Link to="/products?category=two-piece" className="text-gray-400 hover:text-pink-400 transition-colors text-sm">
                  টু পিস
                </Link>
              </li>
              <li>
                <Link to="/products?category=three-piece" className="text-gray-400 hover:text-pink-400 transition-colors text-sm">
                  থ্রি পিস
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-gray-400 hover:text-pink-400 transition-colors text-sm">
                  আমাদের সম্পর্কে
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-lg font-semibold mb-5 text-white">সাহায্য</h3>
            <ul className="space-y-3">
              <li>
                <Link to="/contact" className="text-gray-400 hover:text-pink-400 transition-colors text-sm">
                  যোগাযোগ
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-gray-400 hover:text-pink-400 transition-colors text-sm">
                  শিপিং পলিসি
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-gray-400 hover:text-pink-400 transition-colors text-sm">
                  রিটার্ন পলিসি
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-gray-400 hover:text-pink-400 transition-colors text-sm">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-5 text-white">যোগাযোগ</h3>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-pink-400 flex-shrink-0" />
                <a href="tel:+8801995909243" className="text-gray-400 hover:text-pink-400 transition-colors text-sm">
                  01995-909243
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-pink-400 flex-shrink-0" />
                <a 
                  href="https://www.facebook.com/messages/t/282687191604098/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-gray-400 hover:text-pink-400 transition-colors text-sm"
                >
                  Facebook Inbox
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-pink-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-400 text-sm">
                  Mirpur-13, Dhaka-1216, Bangladesh
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-700/50">
        <div className="container mx-auto px-4 py-5">
          <p className="text-gray-500 text-sm text-center">
            © {new Date().getFullYear()} {siteName}। সর্বস্বত্ব সংরক্ষিত।
          </p>
        </div>
      </div>

      {/* Developer Credit */}
      <div className="bg-black/30 border-t border-gray-700/50">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-xs tracking-[0.2em] text-gray-500 uppercase">
            Developed by{' '}
            <span className="font-bold text-pink-400">PlatiRoll</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
