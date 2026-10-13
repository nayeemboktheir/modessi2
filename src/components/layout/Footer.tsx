import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { Facebook, Instagram, MapPin, MessageCircle, Phone, Youtube } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Stagger, StaggerItem } from '@/components/motion';
import shopLogo from '@/assets/shop-logo.png';

const FACEBOOK_INBOX = 'https://www.facebook.com/messages/t/282687191604098/';
const DEFAULT_PHONE = '01995-909243';

const quickLinks: [string, string][] = [
  ['সব কালেকশন', '/products'],
  ['থ্রি পিস', '/products?category=three-piece'],
  ['শাড়ি', '/products?category=saree'],
  ['আমাদের গল্প', '/about'],
];

const serviceLinks: [string, string][] = [
  ['আমার অ্যাকাউন্ট', '/my-account'],
  ['ডেলিভারি তথ্য', '/contact'],
  ['রিটার্ন পলিসি', '/contact'],
  ['সচরাচর জিজ্ঞাসা', '/contact'],
];

const Footer = () => {
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

  const phone = siteSettings?.call_number?.trim() || siteSettings?.header_phone?.trim() || DEFAULT_PHONE;

  return (
    <footer className="relative mt-auto bg-surface-paper text-ink-muted">
      {/* Burgundy wave that separates the page from the footer. */}
      <svg aria-hidden="true" viewBox="0 0 1440 48" preserveAspectRatio="none" className="block h-6 w-full text-brand-blush sm:h-10">
        <path fill="currentColor" d="M0 48h1440V18c-120 18-240 27-360 27S840 36 720 22 480 0 360 0 120 9 0 22z" />
      </svg>

      <div className="bg-gradient-to-b from-brand-blush/60 to-surface-paper">
        <Stagger className="shell grid gap-10 pb-12 pt-8 sm:pt-10 md:grid-cols-[1.3fr_0.8fr_0.9fr_1fr]" stagger={0.1}>
          <StaggerItem>
            <img src={shopLogo} alt="Modessi" className="h-12 w-auto" loading="lazy" />
            <p className="mt-4 max-w-xs text-[13px] leading-6 text-ink-muted">বাংলাদেশী নারীর জন্য আরামদায়ক, মানসম্মত ও সমসাময়িক পোশাকের নির্ভরযোগ্য ঠিকানা।</p>
            <div className="mt-5 flex gap-2">
              <FooterSocial icon={Facebook} label="Facebook" />
              <FooterSocial icon={Instagram} label="Instagram" />
              <FooterSocial icon={Youtube} label="YouTube" />
            </div>
          </StaggerItem>

          <StaggerItem><FooterColumn title="দ্রুত লিংক" links={quickLinks} /></StaggerItem>
          <StaggerItem><FooterColumn title="কাস্টমার সেবা" links={serviceLinks} /></StaggerItem>

          <StaggerItem>
            <h3 className="text-sm font-bold text-ink">যোগাযোগ</h3>
            <ul className="mt-4 space-y-3.5 text-[13px]">
              <li className="flex gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-brand" />
                <a href={'tel:' + phone.replace(/[^\d+]/g, '')} className="transition-colors hover:text-brand">{phone}</a>
              </li>
              <li className="flex gap-2.5">
                <MessageCircle className="h-4 w-4 shrink-0 text-brand" />
                <a href={FACEBOOK_INBOX} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-brand">Facebook Inbox</a>
              </li>
              <li className="flex gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 text-brand" />
                <span>Mirpur-13, Dhaka-1216, Bangladesh</span>
              </li>
            </ul>
          </StaggerItem>
        </Stagger>
      </div>

      <div className="border-t border-line">
        <div className="shell flex flex-col gap-2 py-4 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:text-[13px]">
          <span>© {new Date().getFullYear()} Modessi. All rights reserved.</span>
          <span>Developed by <span className="font-semibold text-brand">PlatiRoll</span></span>
          <span>Designed with <span className="text-brand">♥</span> for stronger women</span>
        </div>
      </div>
    </footer>
  );
};

function FooterSocial({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <a
      href={FACEBOOK_INBOX}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full bg-white text-brand shadow-sm ring-1 ring-line transition-all duration-300 hover:-translate-y-1 hover:bg-brand hover:text-white hover:shadow-[0_10px_20px_-8px_hsl(var(--brand)/0.6)]"
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link to={href} className="group inline-flex items-center gap-1.5 text-[13px] transition-colors hover:text-brand">
              <span className="h-px w-0 bg-brand transition-all duration-300 group-hover:w-3" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Footer;
