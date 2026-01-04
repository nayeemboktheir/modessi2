import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle, Package, Phone, Home, Truck, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface OrderDetails {
  orderNumber: string;
  customerName?: string;
  phone?: string;
  total?: number;
  fromLandingPage?: boolean;
  landingPageSlug?: string;
}

const OrderConfirmationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as OrderDetails | null;
  
  const orderNumber = state?.orderNumber || '';
  const customerName = state?.customerName;
  const phone = state?.phone;
  const total = state?.total;
  const fromLandingPage = state?.fromLandingPage;
  const landingPageSlug = state?.landingPageSlug;

  

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="text-center mb-8"
        >
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <CheckCircle className="h-14 w-14 text-green-600" />
          </div>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-xl p-8 text-center"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            🎉 অর্ডার সফল হয়েছে!
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে
          </p>

          {/* Order Number */}
          {orderNumber && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 mb-6 border border-green-200">
              <p className="text-sm text-gray-500 mb-1">অর্ডার নম্বর</p>
              <p className="font-mono text-2xl font-bold text-green-700">{orderNumber}</p>
            </div>
          )}

          {/* Customer Info */}
          {(customerName || phone) && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
              {customerName && (
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm">👤</span>
                  </div>
                  <span className="text-gray-700">{customerName}</span>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Phone className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-gray-700">{phone}</span>
                </div>
              )}
            </div>
          )}

          {/* Total */}
          {total && (
            <div className="bg-amber-50 rounded-xl p-4 mb-6 border border-amber-200">
              <p className="text-sm text-amber-700 mb-1">মোট মূল্য</p>
              <p className="text-3xl font-bold text-amber-800">৳{total.toLocaleString()}</p>
            </div>
          )}

          {/* Next Steps */}
          <div className="bg-blue-50 rounded-xl p-6 mb-8 text-left">
            <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              পরবর্তী ধাপসমূহ
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-800 text-xs font-bold">১</span>
                </div>
                <span className="text-gray-700">আমাদের টিম শীঘ্রই আপনার সাথে কল করে অর্ডার কনফার্ম করবে</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-800 text-xs font-bold">২</span>
                </div>
                <span className="text-gray-700">পণ্য প্যাকেজিং করে কুরিয়ারে হস্তান্তর করা হবে</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-800 text-xs font-bold">৩</span>
                </div>
                <span className="text-gray-700">পণ্য হাতে পেয়ে মূল্য পরিশোধ করুন (ক্যাশ অন ডেলিভারি)</span>
              </li>
            </ul>
          </div>

          {/* Delivery Info */}
          <div className="flex items-center justify-center gap-4 mb-8 p-4 bg-green-50 rounded-xl border border-green-200">
            <Truck className="h-8 w-8 text-green-600" />
            <div className="text-left">
              <p className="font-semibold text-green-800">ডেলিভারি সময়</p>
              <p className="text-sm text-green-700">ঢাকায় ১-২ দিন • ঢাকার বাইরে ৩-৫ দিন</p>
            </div>
          </div>

          {/* Contact */}
          <div className="text-center mb-8 p-4 bg-gray-50 rounded-xl">
            <p className="text-gray-600 mb-2">যেকোনো প্রশ্নে কল করুন</p>
            <a href="tel:+8801704466603" className="text-xl font-bold text-primary hover:underline">
              📞 +880 1704-466603
            </a>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <Home className="h-5 w-5" />
              হোমপেজে যান
            </Button>
            <Button
              onClick={() => navigate('/products')}
              size="lg"
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              আরও পণ্য দেখুন
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </motion.div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 grid grid-cols-3 gap-4 text-center"
        >
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <span className="text-2xl block mb-1">🔒</span>
            <p className="text-xs text-gray-600">নিরাপদ পেমেন্ট</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <span className="text-2xl block mb-1">📦</span>
            <p className="text-xs text-gray-600">দ্রুত ডেলিভারি</p>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <span className="text-2xl block mb-1">✅</span>
            <p className="text-xs text-gray-600">১০০% গ্যারান্টি</p>
          </div>
        </motion.div>
      </div>
    </main>
  );
};

export default OrderConfirmationPage;
