import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import { Eye, EyeOff, Lock, ArrowRight, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AuthShell } from '@/components/layout/AuthShell';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a valid session from the password reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValid(true);
      } else {
        toast.error('Invalid or expired reset link');
        navigate('/auth');
      }
    };
    checkSession();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('পাসওয়ার্ড মিলছে না');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) {
        toast.error('পাসওয়ার্ড আপডেট ব্যর্থ হয়েছে');
      } else {
        toast.success('পাসওয়ার্ড সফলভাবে আপডেট হয়েছে!');
        navigate('/my-account');
      }
    } catch (error) {
      toast.error('কিছু ভুল হয়েছে');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isValid) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
      </div>
    );
  }

  return (
    <AuthShell>
          <m.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-[2rem] border border-line bg-white shadow-[0_30px_60px_-35px_rgba(74,30,40,0.5)]"
          >
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-brand to-brand-soft p-8 text-center">
              <span className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 animate-spin-slow rounded-full border-[18px] border-dashed border-white/10" />
              <div className="relative mb-4 inline-flex h-16 w-16 animate-float items-center justify-center rounded-full bg-primary-foreground/10">
                <KeyRound className="h-8 w-8 text-primary-foreground" />
              </div>
              <h1 className="relative text-2xl font-display font-bold text-primary-foreground mb-2">
                নতুন পাসওয়ার্ড সেট করুন
              </h1>
              <p className="relative text-primary-foreground/80">
                আপনার নতুন পাসওয়ার্ড দিন
              </p>
            </div>

            {/* Form */}
            <div className="p-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    নতুন পাসওয়ার্ড
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    পাসওয়ার্ড নিশ্চিত করুন
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="cta"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      অপেক্ষা করুন...
                    </span>
                  ) : (
                    <>
                      পাসওয়ার্ড আপডেট করুন
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </m.div>
    </AuthShell>
  );
};

export default ResetPasswordPage;
