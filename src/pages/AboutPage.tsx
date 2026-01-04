import { motion } from 'framer-motion';
import { CheckCircle, Award, Truck, Gift, Globe, Heart, Leaf } from 'lucide-react';
import datesBasket from '@/assets/dates-basket.png';
import datesBulk from '@/assets/dates-bulk.png';

const AboutPage = () => {
  const features = [
    {
      icon: CheckCircle,
      title: '১০০% বিশুদ্ধ ও আসল খেজুর',
      description: 'আমরা শুধুমাত্র ১০০% খাঁটি ও আসল খেজুরের নিশ্চয়তা দিই।'
    },
    {
      icon: Award,
      title: 'হাতে বাছাই করা',
      description: 'প্রতিটি খেজুর যত্ন সহকারে হাতে বাছাই করা হয়।'
    },
    {
      icon: Truck,
      title: 'দ্রুত ডেলিভারি',
      description: 'প্রিমিয়াম কোয়ালিটি সহ দ্রুত ডেলিভারি সার্ভিস।'
    },
    {
      icon: Gift,
      title: 'বিশেষ অফার',
      description: 'রমজানসহ সারাবছর জুড়ে বিশেষ অফার ও উপহার প্যাক।'
    }
  ];

  const countries = [
    'সৌদি আরব',
    'ইরান',
    'তিউনিসিয়া',
    'আলজেরিয়া',
    'দুবাই',
    'মিশর',
    'জর্ডান',
    'ক্যালিফোর্নিয়া',
    'ফিলিস্তিন'
  ];

  const dateTypes = [
    'আজওয়া',
    'মেডজুল',
    'সুক্কারি',
    'কালমি মরিয়ম',
    'মরিয়ম',
    'মাবরুম'
  ];

  return (
    <div className="pt-32 pb-16">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-20 overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-72 h-72 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary rounded-full blur-3xl" />
        </div>
        <div className="container-custom relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <span className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-6">
              আমাদের সম্পর্কে
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground mb-6 leading-tight">
              খেজুরের বাজার
              <span className="block text-primary">বিশুদ্ধতার প্রতিশ্রুতি</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              "খাঁটি খেজুর পৌঁছে দিই প্রতিটি ঘরে, সুস্থতা ও সুস্বাদের সঙ্গে।"
            </p>
          </motion.div>
        </div>
      </section>

      {/* Founder Section */}
      <section className="py-20">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src={datesBasket}
                  alt="প্রিমিয়াম খেজুর সংগ্রহ"
                  className="w-full h-[400px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                        <Award className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">৮ বছরের অভিজ্ঞতা</p>
                        <p className="text-sm text-muted-foreground">বংশ পরম্পরায় খেজুর ব্যবসা</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Decorative Element */}
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-secondary/20 rounded-full blur-2xl" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-6">
                আমাদের গল্প
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="text-lg">
                  আমি <span className="text-primary font-semibold">আশিক বেপারী</span>, খেজুরের ব্যবসায় ৮ বছরের অভিজ্ঞতা। এটা আমার বংশ পরম্পরায় আমি পেয়েছি।
                </p>
                <p>
                  বাংলাদেশের সব চেয়ে বড় ফল ও খেজুরের মার্কেটে আমার ২টা প্রতিষ্ঠান রয়েছে। অনলাইনে আপনাদের কে সেবা দেয়ার জন্য মূলত আমার আশা।
                </p>
                <p>
                  আমরা বিশ্বাস করি, খেজুর শুধু একটি ফল নয়; এটি আমাদের ধর্মীয় ও সাংস্কৃতিক ঐতিহ্যের অংশ, এক পরিপূর্ণ প্রাকৃতিক পুষ্টির উৎস।
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-8">
                <div className="text-center p-4 bg-muted rounded-xl">
                  <p className="text-2xl font-bold text-primary">৮+</p>
                  <p className="text-sm text-muted-foreground">বছর অভিজ্ঞতা</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-xl">
                  <p className="text-2xl font-bold text-primary">২টি</p>
                  <p className="text-sm text-muted-foreground">প্রতিষ্ঠান</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-xl">
                  <p className="text-2xl font-bold text-primary">৯+</p>
                  <p className="text-sm text-muted-foreground">দেশ থেকে আমদানি</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20 bg-muted/50">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-block px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
              🌟 কেন আমরা?
            </span>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
              কেন "খেজুরের বাজার"?
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-card p-6 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-border group hover:border-primary/30"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Global Sourcing */}
      <section className="py-20">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-6 h-6 text-primary" />
                <span className="text-primary font-medium">বিশ্বব্যাপী সংগ্রহ</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-6">
                বিশ্বের সেরা খেজুর আপনার জন্য
              </h2>
              <p className="text-muted-foreground mb-8">
                বিশ্বের নামকরা দেশগুলো থেকে আমরা বাছাইকৃত প্রিমিয়াম মানের খেজুর আমদানি করি।
              </p>

              <div className="flex flex-wrap gap-2 mb-8">
                {countries.map((country, index) => (
                  <motion.span
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-medium"
                  >
                    {country}
                  </motion.span>
                ))}
              </div>

              <div className="p-6 bg-muted rounded-2xl">
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Leaf className="w-5 h-5 text-primary" />
                  আমাদের সংগ্রহে রয়েছে
                </h4>
                <div className="flex flex-wrap gap-2">
                  {dateTypes.map((type, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-secondary/20 text-secondary-foreground rounded-lg text-sm"
                    >
                      {type}
                    </span>
                  ))}
                  <span className="px-3 py-1 bg-secondary/20 text-secondary-foreground rounded-lg text-sm">
                    এবং আরও...
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <img
                src={datesBulk}
                alt="বিভিন্ন ধরনের খেজুর"
                className="rounded-3xl shadow-xl w-full h-[450px] object-cover"
              />
              <div className="absolute -bottom-4 -left-4 bg-card p-4 rounded-xl shadow-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">১০০% অর্গানিক</p>
                    <p className="text-xs text-muted-foreground">প্রাকৃতিক গুণাগুণ</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center"
          >
            <Heart className="w-16 h-16 mx-auto mb-6 opacity-80" />
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">
              আমাদের লক্ষ্য
            </h2>
            <p className="text-xl opacity-90 mb-8 leading-relaxed">
              আমাদের লক্ষ্য শুধু খেজুর বিক্রি নয় — বরং একটি বিশ্বাসযোগ্য নাম হিসেবে "খেজুরের বাজার" কে গড়ে তোলা, যেখান থেকে মানুষ নিশ্চিন্তে স্বাস্থ্য, ঐতিহ্য ও স্বাদের মেলবন্ধন পাবে।
            </p>
            <div className="inline-block px-8 py-4 bg-white/20 backdrop-blur-sm rounded-2xl">
              <p className="text-lg font-display italic">
                "খেজুরের বাজার — যেখানে প্রতিটি খেজুরে থাকে বিশ্বাসের স্বাদ।"
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
