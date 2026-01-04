import { useState, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ShippingZone = 'inside_dhaka' | 'outside_dhaka';

interface ShippingMethodSelectorProps {
  address: string;
  selectedZone: ShippingZone;
  onZoneChange: (zone: ShippingZone) => void;
}

const SHIPPING_RATES = {
  inside_dhaka: 80,
  outside_dhaka: 130,
};

// Keywords that indicate Dhaka location
const DHAKA_KEYWORDS = [
  'dhaka', 'ঢাকা', 'dhanmondi', 'ধানমন্ডি', 'gulshan', 'গুলশান', 'banani', 'বনানী',
  'mirpur', 'মিরপুর', 'uttara', 'উত্তরা', 'mohammadpur', 'মোহাম্মদপুর', 'motijheel', 'মতিঝিল',
  'farmgate', 'ফার্মগেট', 'tejgaon', 'তেজগাঁও', 'badda', 'বাড্ডা', 'rampura', 'রামপুরা',
  'khilgaon', 'খিলগাঁও', 'basabo', 'বাসাবো', 'shyamoli', 'শ্যামলী', 'kalabagan', 'কলাবাগান',
  'panthapath', 'পান্থপথ', 'elephant road', 'new market', 'নিউ মার্কেট', 'azimpur', 'আজিমপুর',
  'lalbagh', 'লালবাগ', 'old dhaka', 'পুরান ঢাকা', 'jatrabari', 'যাত্রাবাড়ী', 'demra', 'ডেমরা',
  'keraniganj', 'কেরানীগঞ্জ', 'savar', 'সাভার', 'tongi', 'টঙ্গী', 'gazipur', 'গাজীপুর',
  'narayanganj', 'নারায়ণগঞ্জ', 'bashundhara', 'বসুন্ধরা', 'aftabnagar', 'আফতাবনগর',
  'banasree', 'বনশ্রী', 'mogbazar', 'মগবাজার', 'eskaton', 'ইস্কাটন', 'malibagh', 'মালিবাগ',
  'shantinagar', 'শান্তিনগর', 'kakrail', 'কাকরাইল', 'paltan', 'পল্টন', 'shahbag', 'শাহবাগ',
  'sadarghat', 'সদরঘাট', 'kotwali', 'কোতোয়ালি', 'chawkbazar', 'চকবাজার', 'wari', 'ওয়ারী',
  'sutrapur', 'সূত্রাপুর', 'hazaribagh', 'হাজারীবাগ', 'kamrangirchar', 'কামরাঙ্গীরচর',
  'adabor', 'আদাবর', 'kafrul', 'কাফরুল', 'pallabi', 'পল্লবী', 'dakshinkhan', 'দক্ষিণখান',
  'khilkhet', 'খিলক্ষেত', 'nikunja', 'নিকুঞ্জ', 'airport', 'বিমানবন্দর', 'cantonment', 'সেনানিবাস',
  'postogola', 'পোস্তগোলা', 'shutrapur', 'শুটরপুর', 'dhaka-1', 'dhaka 1', '1205', '1207', '1208', '1209',
  '1210', '1211', '1212', '1213', '1214', '1215', '1216', '1217', '1218', '1219', '1220', '1221',
  '1222', '1223', '1224', '1225', '1226', '1227', '1228', '1229', '1230', '1231', '1232', '1233',
  '1234', '1235', '1236', '1000', '1100', '1200', '1201', '1202', '1203', '1204', '1206',
];

function detectShippingZone(address: string): ShippingZone {
  const normalizedAddress = address.toLowerCase().trim();
  
  for (const keyword of DHAKA_KEYWORDS) {
    if (normalizedAddress.includes(keyword.toLowerCase())) {
      return 'inside_dhaka';
    }
  }
  
  return 'outside_dhaka';
}

export function ShippingMethodSelector({ 
  address, 
  selectedZone, 
  onZoneChange 
}: ShippingMethodSelectorProps) {
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [autoDetectedZone, setAutoDetectedZone] = useState<ShippingZone | null>(null);

  // Auto-detect zone when address changes
  useEffect(() => {
    if (!address.trim()) {
      setAutoDetectedZone(null);
      return;
    }

    setIsAutoDetecting(true);
    
    // Simulate slight delay for UX
    const timer = setTimeout(() => {
      const detected = detectShippingZone(address);
      setAutoDetectedZone(detected);
      onZoneChange(detected);
      setIsAutoDetecting(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [address, onZoneChange]);

  const getShippingCost = (zone: ShippingZone) => SHIPPING_RATES[zone];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">Shipping Zone</h3>
        {isAutoDetecting && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Detecting location...
          </div>
        )}
        {!isAutoDetecting && autoDetectedZone && (
          <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">
            Auto-detected
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Inside Dhaka */}
        <button
          type="button"
          onClick={() => onZoneChange('inside_dhaka')}
          className={cn(
            "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
            selectedZone === 'inside_dhaka'
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
        >
          <MapPin className={cn(
            "h-6 w-6",
            selectedZone === 'inside_dhaka' ? "text-primary" : "text-muted-foreground"
          )} />
          <span className={cn(
            "font-medium text-sm",
            selectedZone === 'inside_dhaka' ? "text-primary" : "text-foreground"
          )}>
            Inside Dhaka
          </span>
          <span className={cn(
            "text-lg font-bold",
            selectedZone === 'inside_dhaka' ? "text-primary" : "text-foreground"
          )}>
            ৳{getShippingCost('inside_dhaka')}
          </span>
          {selectedZone === 'inside_dhaka' && (
            <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </button>

        {/* Outside Dhaka */}
        <button
          type="button"
          onClick={() => onZoneChange('outside_dhaka')}
          className={cn(
            "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
            selectedZone === 'outside_dhaka'
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
        >
          <MapPin className={cn(
            "h-6 w-6",
            selectedZone === 'outside_dhaka' ? "text-primary" : "text-muted-foreground"
          )} />
          <span className={cn(
            "font-medium text-sm",
            selectedZone === 'outside_dhaka' ? "text-primary" : "text-foreground"
          )}>
            Outside Dhaka
          </span>
          <span className={cn(
            "text-lg font-bold",
            selectedZone === 'outside_dhaka' ? "text-primary" : "text-foreground"
          )}>
            ৳{getShippingCost('outside_dhaka')}
          </span>
          {selectedZone === 'outside_dhaka' && (
            <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

export { SHIPPING_RATES };
