-- Insert additional SMS templates
INSERT INTO public.sms_templates (template_key, template_name, message_template, description, is_active) VALUES
('order_placed', 'অর্ডার প্লেসড', 'প্রিয় {{customer_name}}, আপনার অর্ডার #{{order_number}} সফলভাবে গ্রহণ করা হয়েছে। মোট: ৳{{total}}। ধন্যবাদ!', 'অর্ডার প্লেস হওয়ার পর পাঠানো হয়', true),
('order_confirmed', 'অর্ডার কনফার্মড', 'প্রিয় {{customer_name}}, আপনার অর্ডার #{{order_number}} কনফার্ম করা হয়েছে। শীঘ্রই ডেলিভারি দেওয়া হবে। ধন্যবাদ!', 'অর্ডার কনফার্ম হওয়ার পর পাঠানো হয়', true),
('manual_order', 'ম্যানুয়াল অর্ডার', 'প্রিয় {{customer_name}}, আপনার জন্য একটি অর্ডার #{{order_number}} তৈরি করা হয়েছে। মোট: ৳{{total}}। বিস্তারিত জানতে কল করুন।', 'এডমিন থেকে অর্ডার তৈরি হলে পাঠানো হয়', true),
('order_processing', 'অর্ডার প্রসেসিং', 'প্রিয় {{customer_name}}, আপনার অর্ডার #{{order_number}} প্রসেস হচ্ছে। শীঘ্রই শিপমেন্ট করা হবে।', 'অর্ডার প্রসেসিং এ গেলে পাঠানো হয়', true)
ON CONFLICT (template_key) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  message_template = EXCLUDED.message_template,
  description = EXCLUDED.description;