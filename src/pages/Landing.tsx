import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from "react-i18next";

const Landing: React.FC = () => {
  const { t } = useTranslation();
  const { signInWithGoogle } = useAuth();
  const APP_TITLE = "KALKULATOR KALORI";
  const APP_SUBTITLE = "Hitung kalori makanan dan minuman dengan mudah dan cepat";
  const BRANDING = "[PROMPT ONE VISUALS]";

  const handleGoogleLogin = async () => {
    const { error } = await signInWithGoogle();
    if (!error) {
      window.location.assign("/");
      return;
    }

    console.error("Google sign-in failed:", error);
    window.alert(t("header.googleLoginFailed"));
  };

  const handleOpenApp = () => {
    try {
      localStorage.setItem("guest-access", "true");
    } catch (error) {
      console.warn("Guest access storage failed:", error);
    }
    window.location.assign("/?guest=1");
  };

  return (
    <div className="min-h-screen bg-[#0b0b0b] flex flex-col p-6 relative">
      <div className="flex-1 w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
        {/* LEFT: Content */}
        <div className="flex flex-col items-start gap-6 md:gap-5">
          <div className="space-y-3">
            <h1 className="text-tv-title text-foreground">{APP_TITLE}</h1>
            <p className="text-tv-body text-muted-foreground max-w-md">
              {APP_SUBTITLE}
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 w-full max-w-sm">
            <Button
              size="lg"
              onClick={handleOpenApp}
              className="w-full touch-target text-tv-body font-medium px-8 md:px-12 py-6 md:py-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              START
            </Button>
            <Button
              size="sm"
              onClick={handleGoogleLogin}
              className="w-full touch-target text-tv-small font-medium px-6 md:px-10 py-4 md:py-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 bg-primary text-primary-foreground"
            >
              <span className="inline-flex items-center gap-2">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 48 48"
                  className="h-4 w-4"
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.3 0 6.3 1.1 8.6 3l5.9-5.9C34.6 3 29.7 1 24 1 14.6 1 6.6 6.4 2.7 14.4l6.8 5.3C11.2 13.2 17.1 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.7h12.5c-.3 2-1.5 5-4.2 7l6.5 5c3.8-3.5 5.3-8.6 5.3-15.6z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M9.5 28.7c-.5-1.3-.8-2.8-.8-4.2s.3-2.9.8-4.2l-6.8-5.3C1.6 17.5 1 20.1 1 24.5s.6 7 1.7 9.5l6.8-5.3z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 47c5.7 0 10.5-1.9 14-5.2l-6.5-5c-1.8 1.2-4.3 2.1-7.5 2.1-6.9 0-12.8-3.7-14.5-8.9l-6.8 5.3C6.6 41.6 14.6 47 24 47z"
                  />
                </svg>
                <span>LOGIN</span>
              </span>
            </Button>
          </div>
        </div>

        {/* RIGHT: Hero */}
        <div className="flex justify-center md:justify-end">
          <img
            src="/bmihero.png"
            alt="BMI Hero"
            className="w-full max-w-md md:max-w-sm lg:max-w-md h-auto max-h-[80vh] object-contain"
          />
        </div>
      </div>

      {/* Mobile order tweak */}
      <div className="md:hidden order-3 mt-6 flex justify-center">
        <img
          src="/bmihero.png"
          alt="BMI Hero"
          className="w-full max-w-xs h-auto max-h-[40vh] object-contain"
        />
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-6 inset-x-0 flex justify-center">
        <p className="text-xs text-muted-foreground tracking-[0.2em]">
          {BRANDING}
        </p>
      </div>
    </div>
  );
};

export default Landing;
