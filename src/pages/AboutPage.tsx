import { m } from 'framer-motion';
import { Heart, ShieldCheck, Truck, RefreshCw, MessageCircle, Users, Sparkles, Package } from 'lucide-react';
import Header from '@/components/layout/Header';

const AboutPage = () => {
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

  return (
    <>
      <Header />
      <div className="pt-32 pb-16">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-primary/10 via-background to-accent/10 py-24 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
          </div>
          
          <div className="container-custom relative z-10">
            <m.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-4xl mx-auto"
            >
              <m.span 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-block px-6 py-3 bg-primary/10 text-primary rounded-full text-sm font-semibold mb-8 border border-primary/20"
              >
                ✨ আমাদের সম্পর্কে
              </m.span>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground mb-8 leading-tight">
                সুন্দর পোশাক শুধু ফ্যাশন নয়—
                <span className="block text-primary mt-2">এটা আত্মবিশ্বাসের প্রকাশ</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                এই বিশ্বাস থেকেই আমাদের যাত্রা।
              </p>
            </m.div>
          </div>
        </section>

        {/* Main Story Section */}
        <section className="py-20">
          <div className="container-custom">
            <div className="max-w-4xl mx-auto">
              <m.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="text-center mb-16"
              >
                <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-8">
                  আমাদের গল্প
                </h2>
                
                <div className="space-y-6 text-lg text-muted-foreground leading-relaxed">
                  <p>
                    আমাদের প্রতিষ্ঠানটি মূলত <span className="text-primary font-semibold">প্রিমিয়াম থ্রি-পিস, শাড়ি ও ফ্যাশন ড্রেস</span> সরবরাহ করে থাকে, যেখানে <span className="text-foreground font-medium">কোয়ালিটি, কমফোর্ট ও ট্রেন্ড</span>—এই তিনটির ওপর আমরা সর্বোচ্চ গুরুত্ব দিই।
                  </p>
                  
                  <p>
                    আমাদের সব পণ্য নিজস্ব ফ্যাক্টরি ও বিশ্বস্ত সোর্স থেকে সংগ্রহ করা হয়, যেন কাস্টমার পান <span className="text-primary font-semibold">সেরা মানের কাপড় ন্যায্য দামে</span>।
                  </p>
                </div>
              </m.div>

              {/* Highlight Box */}
              <m.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-3xl p-8 md:p-12 border border-primary/10 mb-16"
              >
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
                    <Package className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-4">
                    খুচরা ও পাইকারি—দুইভাবেই বিক্রি করি
                  </h3>
                  <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
                    বিশেষ করে যারা অল্প পুঁজি নিয়ে কাপড়ের ব্যবসা শুরু করতে চান, তাদের জন্য আমাদের রয়েছে—
                  </p>
                  <div className="flex flex-wrap justify-center gap-4">
                    <span className="px-5 py-3 bg-primary text-primary-foreground rounded-full font-medium">
                      মাত্র ৬ পিসে পাইকারি
                    </span>
                    <span className="px-5 py-3 bg-accent text-accent-foreground rounded-full font-medium">
                      ডিজাইন চয়েসের স্বাধীনতা
                    </span>
                    <span className="px-5 py-3 bg-secondary text-secondary-foreground rounded-full font-medium">
                      এক্সচেঞ্জ সাপোর্ট
                    </span>
                  </div>
                </div>
              </m.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-muted/30">
          <div className="container-custom">
            <m.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <span className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
                🌟 কেন আমরা বিশেষ?
              </span>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                আমাদের বৈশিষ্ট্য
              </h2>
            </m.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <m.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-border group hover:border-primary/30 hover:-translate-y-1"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </m.div>
              ))}
            </div>
          </div>
        </section>

        {/* Goals Section */}
        <section className="py-20">
          <div className="container-custom">
            <m.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <span className="inline-block px-4 py-2 bg-accent/10 text-accent-foreground rounded-full text-sm font-medium mb-4">
                🎯 আমাদের লক্ষ্য
              </span>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
                শুধু পণ্য বিক্রি করা নয়—
              </h2>
            </m.div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {goals.map((goal, index) => (
                <m.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  className="text-center group"
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/70 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-primary/20">
                    <goal.icon className="w-10 h-10 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    {goal.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {goal.description}
                  </p>
                </m.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          </div>
          
          <div className="container-custom relative z-10">
            <m.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-4xl mx-auto text-center"
            >
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
                আপনার পাশে আছি আমরা
              </h2>
              <p className="text-xl opacity-90 mb-8 leading-relaxed max-w-2xl mx-auto">
                আপনি যদি নিজের জন্য সুন্দর পোশাক খুঁজে থাকেন, অথবা ব্যবসার জন্য একটি নির্ভরযোগ্য সাপ্লায়ার চান—আমরা আছি আপনার পাশে।
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-6 py-4">
                  <MessageCircle className="w-6 h-6" />
                  <span className="font-medium">যেকোনো প্রশ্ন বা অর্ডারের জন্য ইনবক্স করুন</span>
                </div>
              </div>
              
              <div className="inline-block px-8 py-5 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/20">
                <p className="text-xl font-display">
                  🤝 আমাদের সাথে থাকুন—<span className="font-bold">স্টাইল আর বিশ্বাসের পথে</span>
                </p>
              </div>
            </m.div>
          </div>
        </section>
      </div>
    </>
  );
};

export default AboutPage;
