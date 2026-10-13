import { m, useReducedMotion } from 'framer-motion';
import { Heart, ShieldCheck, Truck, RefreshCw, MessageCircle, Users, Sparkles, Package } from 'lucide-react';
import { Parallax, Reveal, Stagger, StaggerItem, EASE_OUT } from '@/components/motion';

const AboutPage = () => {
  const reduce = useReducedMotion();

  const features = [
    {
      icon: ShieldCheck,
      title: 'প্রিমিয়াম কোয়ালিটি',
      description: 'সর্বোচ্চ মানের কাপড় ও সেলাই নিশ্চিত করি প্রতিটি পণ্যে।'
    },
    {
      icon: Sparkles,
      title: 'ট্রেন্ডি ডিজাইন',
      description: 'সর্বশেষ ফ্যাশন ট্রেন্ড অনুসরণ করে ডিজাইন করা হয়।'
    },
    {
      icon: Package,
      title: '৬ পিসে পাইকারি',
      description: 'মাত্র ৬ পিসে পাইকারি সুবিধা সহ ডিজাইন চয়েসের স্বাধীনতা।'
    },
    {
      icon: RefreshCw,
      title: 'এক্সচেঞ্জ সাপোর্ট',
      description: 'সহজ এক্সচেঞ্জ পলিসি সহ হ্যাসেল-ফ্রি শপিং।'
    }
  ];

  const goals = [
    {
      icon: Heart,
      title: 'কাস্টমারের বিশ্বাস অর্জন',
      description: 'প্রতিটি অর্ডারে সন্তুষ্টি নিশ্চিত করা আমাদের প্রধান লক্ষ্য।'
    },
    {
      icon: Users,
      title: 'রিসেলারদের ব্যবসা সহজ করা',
      description: 'অল্প পুঁজিতে ব্যবসা শুরু করার সুযোগ তৈরি করা।'
    },
    {
      icon: Truck,
      title: 'দ্রুত ও নিরাপদ ডেলিভারি',
      description: 'সারা বাংলাদেশে দ্রুত ও যত্ন সহকারে পণ্য পৌঁছে দেওয়া।'
    }
  ];

  const heroLine = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_OUT } },
  };

  return (
    <div className="bg-surface">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-blush via-surface to-surface-warm py-20 sm:py-28">
        <Parallax distance={160} className="pointer-events-none absolute -left-20 top-0 h-96 w-96">
          <div className="h-full w-full rounded-full bg-brand/10 blur-3xl" />
        </Parallax>
        <Parallax distance={-140} className="pointer-events-none absolute -right-10 bottom-0 h-80 w-80">
          <div className="h-full w-full rounded-full bg-gold/15 blur-3xl" />
        </Parallax>
        <div className="pointer-events-none absolute right-[8%] top-12 hidden h-40 w-40 animate-spin-slow rounded-full border-[18px] border-dashed border-brand/10 md:block" />

        <div className="shell relative z-10">
          <m.div
            initial={reduce ? false : 'hidden'}
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.15 } } }}
            className="mx-auto max-w-4xl text-center"
          >
            <m.span variants={heroLine} className="mb-8 inline-block rounded-full border border-brand/20 bg-white/70 px-6 py-3 text-sm font-semibold text-brand backdrop-blur">
              ✨ আমাদের সম্পর্কে
            </m.span>

            <m.h1 variants={heroLine} className="mb-8 text-4xl font-bold leading-tight tracking-[-0.03em] text-ink md:text-5xl lg:text-6xl">
              সুন্দর পোশাক শুধু ফ্যাশন নয়—
              <span className="mt-2 block bg-gradient-to-r from-brand via-brand-soft to-gold bg-clip-text text-transparent">এটা আত্মবিশ্বাসের প্রকাশ</span>
            </m.h1>

            <m.p variants={heroLine} className="mx-auto max-w-2xl text-xl leading-relaxed text-ink-muted md:text-2xl">
              এই বিশ্বাস থেকেই আমাদের যাত্রা।
            </m.p>
          </m.div>
        </div>
      </section>

      {/* Main Story Section */}
      <section className="py-20">
        <div className="shell">
          <div className="mx-auto max-w-4xl">
            <Reveal className="mb-16 text-center">
              <h2 className="mb-8 text-3xl font-bold text-ink md:text-4xl">
                আমাদের গল্প
              </h2>

              <div className="space-y-6 text-lg leading-relaxed text-ink-muted">
                <p>
                  আমাদের প্রতিষ্ঠানটি মূলত <span className="font-semibold text-brand">প্রিমিয়াম থ্রি-পিস, শাড়ি ও ফ্যাশন ড্রেস</span> সরবরাহ করে থাকে, যেখানে <span className="font-medium text-ink">কোয়ালিটি, কমফোর্ট ও ট্রেন্ড</span>—এই তিনটির ওপর আমরা সর্বোচ্চ গুরুত্ব দিই।
                </p>

                <p>
                  আমাদের সব পণ্য নিজস্ব ফ্যাক্টরি ও বিশ্বস্ত সোর্স থেকে সংগ্রহ করা হয়, যেন কাস্টমার পান <span className="font-semibold text-brand">সেরা মানের কাপড় ন্যায্য দামে</span>।
                </p>
              </div>
            </Reveal>

            {/* Highlight Box */}
            <Reveal scale className="relative overflow-hidden rounded-[2rem] border border-brand/10 bg-white p-8 shadow-[0_30px_60px_-40px_rgba(74,30,40,0.5)] md:p-12">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-blush" />
              <div className="relative text-center">
                <div className="mb-6 inline-flex h-16 w-16 animate-float items-center justify-center rounded-2xl bg-brand-blush">
                  <Package className="h-8 w-8 text-brand" />
                </div>
                <h3 className="mb-4 text-2xl font-bold text-ink md:text-3xl">
                  খুচরা ও পাইকারি—দুইভাবেই বিক্রি করি
                </h3>
                <p className="mx-auto mb-6 max-w-2xl text-lg text-ink-muted">
                  বিশেষ করে যারা অল্প পুঁজি নিয়ে কাপড়ের ব্যবসা শুরু করতে চান, তাদের জন্য আমাদের রয়েছে—
                </p>
                <Stagger className="flex flex-wrap justify-center gap-3" stagger={0.12}>
                  <StaggerItem className="rounded-full bg-brand px-5 py-3 font-medium text-white shadow-cta">
                    মাত্র ৬ পিসে পাইকারি
                  </StaggerItem>
                  <StaggerItem className="rounded-full bg-gold px-5 py-3 font-medium text-ink">
                    ডিজাইন চয়েসের স্বাধীনতা
                  </StaggerItem>
                  <StaggerItem className="rounded-full bg-surface-warm px-5 py-3 font-medium text-ink">
                    এক্সচেঞ্জ সাপোর্ট
                  </StaggerItem>
                </Stagger>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-surface-warm py-20">
        <div className="shell">
          <Reveal className="mb-12 text-center">
            <span className="mb-4 inline-block rounded-full bg-white px-4 py-2 text-sm font-medium text-brand">
              🌟 কেন আমরা বিশেষ?
            </span>
            <h2 className="text-3xl font-bold text-ink md:text-4xl">
              আমাদের বৈশিষ্ট্য
            </h2>
          </Reveal>

          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" stagger={0.1}>
            {features.map((feature, index) => (
              <StaggerItem key={index}>
                <div className="group relative h-full overflow-hidden rounded-3xl border border-line bg-white p-6 shadow-sm transition-all duration-500 hover:-translate-y-2 hover:border-brand/25 hover:shadow-[0_24px_44px_-24px_rgba(110,25,50,0.45)]">
                  <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-brand via-gold to-brand transition-transform duration-700 group-hover:scale-x-100" />
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blush transition-all duration-500 group-hover:rotate-6 group-hover:bg-brand">
                    <feature.icon className="h-7 w-7 text-brand transition-colors group-hover:text-white" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-ink">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-ink-muted">
                    {feature.description}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Goals Section */}
      <section className="py-20">
        <div className="shell">
          <Reveal className="mb-12 text-center">
            <span className="mb-4 inline-block rounded-full bg-gold/15 px-4 py-2 text-sm font-medium text-ink">
              🎯 আমাদের লক্ষ্য
            </span>
            <h2 className="mb-4 text-3xl font-bold text-ink md:text-4xl">
              শুধু পণ্য বিক্রি করা নয়—
            </h2>
          </Reveal>

          <Stagger className="mx-auto grid max-w-5xl gap-10 md:grid-cols-3" stagger={0.15}>
            {goals.map((goal, index) => (
              <StaggerItem key={index} className="group text-center">
                <div className="relative mx-auto mb-6 h-20 w-20">
                  <span className="absolute inset-0 rotate-6 rounded-2xl bg-gold/30 transition-transform duration-500 group-hover:rotate-12" />
                  <span className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-soft shadow-cta transition-transform duration-500 group-hover:-translate-y-1">
                    <goal.icon className="h-10 w-10 text-white" />
                  </span>
                </div>
                <h3 className="mb-3 text-xl font-semibold text-ink">
                  {goal.title}
                </h3>
                <p className="text-ink-muted">
                  {goal.description}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden bg-[#7f1c3a] py-20 text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 animate-spin-slow rounded-full border-[34px] border-dashed border-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5 blur-2xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_120%,hsl(var(--accent)/0.25),transparent_55%)]" />

        <div className="shell relative z-10">
          <Reveal className="mx-auto max-w-4xl text-center">
            <h2 className="mb-6 text-3xl font-bold md:text-4xl">
              আপনার পাশে আছি আমরা
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-xl leading-relaxed opacity-90">
              আপনি যদি নিজের জন্য সুন্দর পোশাক খুঁজে থাকেন, অথবা ব্যবসার জন্য একটি নির্ভরযোগ্য সাপ্লায়ার চান—আমরা আছি আপনার পাশে।
            </p>

            <div className="mb-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-6 py-4 backdrop-blur-sm">
                <MessageCircle className="h-6 w-6" />
                <span className="font-medium">যেকোনো প্রশ্ন বা অর্ডারের জন্য ইনবক্স করুন</span>
              </div>
            </div>

            <div className="inline-block rounded-2xl border border-white/20 bg-white/15 px-8 py-5 backdrop-blur-sm">
              <p className="text-xl">
                🤝 আমাদের সাথে থাকুন—<span className="font-bold">স্টাইল আর বিশ্বাসের পথে</span>
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
