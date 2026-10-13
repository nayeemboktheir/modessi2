import { useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { Phone, MapPin, Clock, Send, MessageCircle, Truck, Users, Facebook, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Reveal, Stagger, StaggerItem, EASE_OUT } from '@/components/motion';

const ContactPage = () => {
  const reduce = useReducedMotion();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.message.trim()) {
      toast.error('নাম এবং বার্তা অবশ্যই দিতে হবে');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('contact_submissions')
        .insert({
          name: formData.name.trim(),
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
          message: formData.message.trim(),
        });

      if (error) throw error;

      toast.success('আপনার বার্তা পাঠানো হয়েছে!');
      setFormData({ name: '', email: '', phone: '', message: '' });
      setSent(true);
      window.setTimeout(() => setSent(false), 3500);
    } catch (error) {
      console.error('Error submitting contact form:', error);
      toast.error('বার্তা পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactCards = [
    {
      icon: MapPin,
      title: 'ঠিকানা',
      content: 'Road-1, Mirpur-13, Dhaka-1216',
      subContent: 'Dhaka, Bangladesh',
      color: 'from-brand to-brand-soft'
    },
    {
      icon: Phone,
      title: 'মোবাইল / হোয়াটসঅ্যাপ',
      content: '01995-909243',
      subContent: 'সকাল 10টা – রাত 10টা',
      color: 'from-[#6B8E23] to-[#88a843]'
    },
    {
      icon: Facebook,
      title: 'Facebook Inbox',
      content: 'আমাদের পেজে মেসেজ করুন',
      subContent: 'আমাদের টিম দ্রুত রিপ্লাই দেবে',
      color: 'from-[#1877F2] to-[#4f8ff5]'
    },
    {
      icon: Clock,
      title: 'সার্ভিস সময়',
      content: 'সকাল ১০টা - রাত ১০টা',
      subContent: 'প্রতিদিন',
      color: 'from-[#c98a1e] to-gold'
    }
  ];

  const features = [
    {
      icon: Truck,
      title: 'ডেলিভারি',
      description: 'সারা বাংলাদেশে ক্যাশ অন ডেলিভারি সুবিধা রয়েছে। নির্বাচিত পণ্যে ফ্রি ডেলিভারি প্রযোজ্য।',
    },
    {
      icon: Users,
      title: 'পাইকারি ও রিসেলার সাপোর্ট',
      description: 'পাইকারি অর্ডার ও রিসেলার হিসেবে যুক্ত হতে ইনবক্স করুন।',
    }
  ];

  const fieldClass = 'h-12 rounded-xl border-line bg-surface transition-all focus-visible:border-brand focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-brand/10 focus-visible:ring-offset-0';
  const fieldItem = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } } };

  return (
    <div className="min-h-screen bg-surface pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-blush via-surface to-surface-warm py-16 sm:py-24">
        <div className="pointer-events-none absolute -left-16 top-8 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
        <div className="pointer-events-none absolute right-[6%] top-10 hidden h-36 w-36 animate-spin-slow rounded-full border-[16px] border-dashed border-brand/10 md:block" />
        <div className="shell relative z-10">
          <m.div
            initial={reduce ? false : 'hidden'}
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
            className="mx-auto max-w-3xl text-center"
          >
            <m.span variants={fieldItem} className="mb-6 inline-block rounded-full border border-brand/15 bg-white/70 px-4 py-2 text-sm font-medium text-brand backdrop-blur">
              📞 আমাদের সাথে যোগাযোগ করুন
            </m.span>
            <m.h1 variants={fieldItem} className="mb-6 text-4xl font-bold tracking-[-0.03em] text-ink md:text-5xl lg:text-6xl">
              যোগাযোগ করুন
            </m.h1>
            <m.p variants={fieldItem} className="mx-auto max-w-2xl text-lg text-ink-muted">
              আমরা সবসময় আপনার পাশে। যেকোনো প্রশ্ন বা অর্ডারের জন্য আমাদের সাথে যোগাযোগ করুন।
            </m.p>
          </m.div>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="-mt-8 relative z-10">
        <div className="shell">
          <Stagger immediate delay={0.3} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {contactCards.map((card, index) => (
              <StaggerItem key={index}>
                <div className="group relative h-full overflow-hidden rounded-3xl border border-line bg-white p-6 shadow-[0_18px_40px_-30px_rgba(74,30,40,0.4)] transition-all duration-500 hover:-translate-y-1.5 hover:border-brand/25 hover:shadow-[0_26px_50px_-26px_rgba(110,25,50,0.45)]">
                  <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${card.color} opacity-10 transition-transform duration-700 group-hover:scale-150`} />
                  <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${card.color} shadow-lg transition-transform duration-500 group-hover:rotate-6`}>
                    <card.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-ink">
                    {card.title}
                  </h3>
                  <p className="font-medium text-ink-soft">
                    {card.content}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {card.subContent}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12">
        <div className="shell">
          <div className="grid gap-5 md:grid-cols-2">
            {features.map((feature, index) => (
              <Reveal key={index} direction={index === 0 ? 'right' : 'left'}>
                <div className="h-full rounded-3xl border border-line bg-white p-7 transition-all hover:border-brand/25 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-blush text-brand">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="mb-2 text-xl font-semibold text-ink">
                        {feature.title}
                      </h3>
                      <p className="text-ink-muted">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form & Quick Actions */}
      <section className="py-6">
        <div className="shell">
          <div className="grid gap-8 lg:grid-cols-5">
            {/* Quick Actions */}
            <Reveal direction="right" className="space-y-4 lg:col-span-2">
              <h2 className="mb-6 text-2xl font-bold text-ink">
                দ্রুত যোগাযোগ
              </h2>

              {/* WhatsApp Button */}
              <a
                href="https://wa.me/8801995909243"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 p-5 text-white transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-green-500/25"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 transition-transform group-hover:scale-110">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div>
                  <span className="block text-lg font-bold">WhatsApp এ মেসেজ করুন</span>
                  <span className="text-sm text-white/80">01995-909243</span>
                </div>
              </a>

              {/* Call Button */}
              <a
                href="tel:+8801995909243"
                className="group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-brand to-brand-soft p-5 text-white transition-all hover:-translate-y-1 hover:shadow-cta"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 transition-transform group-hover:scale-110">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-lg font-bold">সরাসরি কল করুন</span>
                  <span className="text-sm text-white/80">সকাল 10টা – রাত 10টা</span>
                </div>
              </a>

              {/* Facebook Button */}
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-[#1877F2] to-[#4f8ff5] p-5 text-white transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/25"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 transition-transform group-hover:scale-110">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-lg font-bold">Facebook Inbox</span>
                  <span className="text-sm text-white/80">দ্রুত রিপ্লাই পাবেন</span>
                </div>
              </a>

              {/* Map or Address Card */}
              <div className="rounded-2xl border border-line bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blush">
                    <MapPin className="h-5 w-5 text-brand" />
                  </div>
                  <h3 className="font-semibold text-ink">আমাদের অবস্থান</h3>
                </div>
                <p className="text-ink-muted">
                  Road-1, Mirpur-13, Dhaka-1216<br />
                  Dhaka, Bangladesh
                </p>
              </div>
            </Reveal>

            {/* Contact Form */}
            <Reveal direction="left" delay={0.1} className="lg:col-span-3">
              <div className="relative overflow-hidden rounded-[2rem] border border-line bg-white p-6 shadow-[0_30px_60px_-40px_rgba(74,30,40,0.5)] sm:p-8">
                <h2 className="mb-2 text-2xl font-bold text-ink">
                  বার্তা পাঠান
                </h2>
                <p className="mb-6 text-ink-muted">
                  যেকোনো প্রশ্ন বা অর্ডারের বিস্তারিত জানাতে ফর্মটি পূরণ করুন
                </p>
                <m.form
                  onSubmit={handleSubmit}
                  className="space-y-5"
                  initial={reduce ? false : 'hidden'}
                  whileInView="show"
                  viewport={{ once: true, amount: 0.3 }}
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <m.div variants={fieldItem}>
                      <label className="mb-2 block text-sm font-medium text-ink-soft">
                        আপনার নাম *
                      </label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="নাম লিখুন"
                        className={fieldClass}
                        required
                      />
                    </m.div>
                    <m.div variants={fieldItem}>
                      <label className="mb-2 block text-sm font-medium text-ink-soft">
                        ফোন নম্বর
                      </label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="01XXX-XXXXXX"
                        className={fieldClass}
                      />
                    </m.div>
                  </div>
                  <m.div variants={fieldItem}>
                    <label className="mb-2 block text-sm font-medium text-ink-soft">
                      ইমেইল
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                      className={fieldClass}
                    />
                  </m.div>
                  <m.div variants={fieldItem}>
                    <label className="mb-2 block text-sm font-medium text-ink-soft">
                      আপনার বার্তা *
                    </label>
                    <Textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="আপনার বার্তা লিখুন..."
                      rows={5}
                      className="rounded-xl border-line bg-surface transition-all focus-visible:border-brand focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-brand/10 focus-visible:ring-offset-0"
                      required
                    />
                  </m.div>
                  <m.button
                    variants={fieldItem}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="shine-sweep group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-brand font-semibold text-white shadow-cta transition-colors hover:bg-brand-deep disabled:opacity-70"
                    disabled={isSubmitting}
                  >
                    <Send className="h-5 w-5 transition-transform group-hover:-rotate-12 group-hover:translate-x-0.5" />
                    {isSubmitting ? 'পাঠানো হচ্ছে...' : 'বার্তা পাঠান'}
                  </m.button>
                </m.form>

                {/* Sent overlay */}
                <AnimatePresence>
                  {sent && (
                    <m.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 text-center backdrop-blur"
                    >
                      <m.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }} className="grid h-20 w-20 place-items-center rounded-full bg-[#6B8E23]/10">
                        <CheckCircle2 className="h-10 w-10 text-[#6B8E23]" />
                      </m.span>
                      <m.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-4 text-lg font-semibold text-ink">
                        আপনার বার্তা পাঠানো হয়েছে!
                      </m.p>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
