import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Button } from '@/components/ui/button';
import { toast } from "@/components/ui/sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, signOut, signInWithGoogle } = useAuth();
  const getUserLanguageKey = (uid: string) => `language:${uid}`;
  const getUserThemeKey = (uid: string) => `theme-mode:${uid}`;
  const guestThemeKey = "theme-mode-guest";
  const APP_TITLE = "KALKULATOR KALORI";
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAdmin, isLoading: profileLoading } = useProfile(Boolean(user));
  const [isGuest, setIsGuest] = useState(false);
  const [splitViewEnabled, setSplitViewEnabled] = useState(false);
  const [profileSetupVisible, setProfileSetupVisible] = useState(false);
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  useEffect(() => {
    try {
      setIsGuest(localStorage.getItem("guest-access") === "true");
    } catch {
      setIsGuest(false);
    }
    try {
      setSplitViewEnabled(localStorage.getItem("splitview-enabled") === "true");
    } catch {
      setSplitViewEnabled(false);
    }
    try {
      setProfileSetupVisible(localStorage.getItem("profile-setup-visible") === "true");
    } catch {
      setProfileSetupVisible(false);
    }
    setThemeMode("dark");
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isGuest && !user) {
      if (i18n.language !== "id") i18n.changeLanguage("id");
      document.documentElement.setAttribute("lang", "id");
      return;
    }
    if (!user) {
      if (i18n.language !== "id") i18n.changeLanguage("id");
      document.documentElement.setAttribute("lang", "id");
      return;
    }
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(getUserLanguageKey(user.uid));
    } catch {
      stored = null;
    }
    const next = stored === "en" ? "en" : "id";
    if (i18n.language !== next) i18n.changeLanguage(next);
    document.documentElement.setAttribute("lang", next);
  }, [user, isGuest, i18n]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isGuest && !user) {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(guestThemeKey);
      } catch {
        stored = null;
      }
      const next = stored === "light" ? "light" : "dark";
      setThemeMode(next);
      document.documentElement.setAttribute("data-theme", next);
      return;
    }
    if (!user) {
      setThemeMode("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      return;
    }
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(getUserThemeKey(user.uid));
      if (!stored) {
        const legacy = localStorage.getItem("theme-mode");
        if (legacy) {
          stored = legacy;
          localStorage.setItem(getUserThemeKey(user.uid), legacy);
        }
      }
    } catch {
      stored = null;
    }
    const next = stored === "light" ? "light" : "dark";
    setThemeMode(next);
    document.documentElement.setAttribute("data-theme", next);
  }, [user, isGuest]);

  useEffect(() => {
    if (!user || profileLoading) return;
    if (!profile) {
      setProfileSetupVisible(true);
      try {
        localStorage.setItem("profile-setup-visible", "true");
      } catch (error) {
        console.warn("Profile setup preference save failed:", error);
      }
    }
  }, [user, profile, profileLoading]);

  const isAdminPage = location.pathname === "/admin";
  const isCalculatorPage = location.pathname === "/";
  const isHealthMetricsPage = location.pathname === "/health-metrics";
  const isSplitViewPage = location.pathname === "/kalkulator-bmi";
  const showAdminButton = Boolean(user) && isAdmin && !isAdminPage;
  const showSplitViewLink = isAdminPage && splitViewEnabled;
  const showCalculatorButton =
    Boolean(user) && !isCalculatorPage && !isSplitViewPage && !(isAdminPage && splitViewEnabled);
  const showBmiButton =
    (isCalculatorPage || isAdminPage) && !isSplitViewPage && !(isAdminPage && splitViewEnabled);
  const showSplitOption = Boolean(user) || isGuest;

  const handleSignOut = async () => {
    const confirmed = window.confirm(t("actions.confirmSignOut"));
    if (!confirmed) return;
    try {
      await signOut();
    } finally {
      try {
        if (isGuest && !user) {
          localStorage.clear();
        } else {
          localStorage.removeItem("guest-access");
          localStorage.removeItem(guestThemeKey);
        }
      } catch (error) {
        console.warn("Guest access cleanup failed:", error);
      }
      setThemeMode("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      window.location.assign("/");
    }
  };

  const handleBmiClick: React.MouseEventHandler<HTMLButtonElement> = async (event) => {
    if (user) return;
    if (!isGuest) return;
    event.preventDefault();
    const confirmed = window.confirm(t("header.bmiLoginRequiredConfirm"));
    if (!confirmed) return;
    const { error } = await signInWithGoogle();
    if (!error) {
      window.location.assign("/health-metrics");
      return;
    }
    window.alert(t("header.googleLoginFailed"));
  };

  const handleSplitViewClick = async () => {
    const setPreference = (enabled: boolean) => {
      setSplitViewEnabled(enabled);
      try {
        localStorage.setItem("splitview-enabled", enabled ? "true" : "false");
      } catch (error) {
        console.warn("Split view preference save failed:", error);
      }
    };

    if (user) {
      const next = !splitViewEnabled;
      setPreference(next);
      navigate(next ? "/kalkulator-bmi" : "/");
      return;
    }
    if (!isGuest) return;
    const confirmed = window.confirm(t("header.bmiLoginRequiredConfirm"));
    if (!confirmed) return;
    const { error } = await signInWithGoogle();
    if (!error) {
      setPreference(true);
      navigate("/kalkulator-bmi");
      return;
    }
    window.alert(t("header.googleLoginFailed"));
  };

  const handleProfileSetupToggle = () => {
    if (user && !profile) {
      toast(t("header.profileSetupToast"));
      return;
    }
    const next = !profileSetupVisible;
    setProfileSetupVisible(next);
    try {
      localStorage.setItem("profile-setup-visible", next ? "true" : "false");
    } catch (error) {
      console.warn("Profile setup preference save failed:", error);
    }
    window.dispatchEvent(new Event("profile-setup-toggle"));
  };

  const handleThemeToggle = () => {
    const next = themeMode === "dark" ? "light" : "dark";
    setThemeMode(next);
    try {
      if (user?.uid) {
        localStorage.setItem(getUserThemeKey(user.uid), next);
      } else if (isGuest) {
        localStorage.setItem(guestThemeKey, next);
      }
    } catch (error) {
      console.warn("Theme preference save failed:", error);
    }
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleLanguageSelect = (next: "id" | "en") => {
    if (next === i18n.language) {
      setLanguageMenuOpen(false);
      return;
    }
    const label =
      next === "en" ? t("header.languageEnglish") : t("header.languageIndonesian");
    const confirmed = window.confirm(t("header.confirmLanguageChange", { language: label }));
    if (!confirmed) return;
    i18n.changeLanguage(next);
    try {
      if (user?.uid) {
        localStorage.setItem(getUserLanguageKey(user.uid), next);
      }
    } catch (error) {
      console.warn("Language preference save failed:", error);
    }
    document.documentElement.setAttribute("lang", next);
    setLanguageMenuOpen(false);
  };

  const avatarSrc = profile?.photoUrl || "/defaultico.png";
  const displayLabel =
    (isGuest && !user)
      ? t("header.guestLabel")
      : profile?.username ||
        user?.displayName ||
        user?.email?.split("@")[0] ||
        "";
  const initials = (() => {
    if (isGuest && !user) return t("header.guestLabel");
    const trimmed = displayLabel.trim();
    if (!trimmed) return "U";
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  })();

  const canToggleProfileSetup = Boolean(user) && Boolean(profile);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
      <div className="container mx-auto px-4 h-16 md:h-20 lg:h-24 flex items-center justify-between">
        {/* Logo and App Name */}
        <div className="flex items-center gap-3 md:gap-4">
          <img 
            src="/bmicalico1.png" 
            alt={APP_TITLE} 
            className="h-10 w-10 md:h-14 md:w-14 lg:h-16 lg:w-16 object-contain"
          />
          <h1 className="text-tv-title text-foreground font-bold">
            {APP_TITLE}
          </h1>
        </div>

        {/* User Actions */}
        <div className="flex items-center gap-3">
          {showAdminButton && (
            <Button asChild variant="secondary" className="touch-target">
              <Link to="/admin">{t("header.adminPage")}</Link>
            </Button>
          )}
          {showSplitViewLink && (
            <Button asChild variant="secondary" className="touch-target">
              <Link to="/kalkulator-bmi">{t("header.splitLink")}</Link>
            </Button>
          )}
          {showCalculatorButton && (
            <Button asChild variant="secondary" className="touch-target">
              <Link to="/">{t("header.calculator")}</Link>
            </Button>
          )}
          {showBmiButton && (user || isGuest) && (
            user ? (
              <Button asChild variant="secondary" className="touch-target">
                <Link to="/health-metrics">{t("header.bmiIndex")}</Link>
              </Button>
            ) : (
              <Button variant="secondary" className="touch-target" onClick={handleBmiClick}>
                {t("header.bmiIndex")}
              </Button>
            )
          )}
          <div className="flex items-center gap-2">
            <span className="text-tv-small text-muted-foreground hidden md:inline-block">
              {initials}
            </span>
            <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="h-10 w-10 md:h-11 md:w-11 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center hover:ring-2 hover:ring-primary/40 transition"
                title={t("header.profileTitle")}
              >
                <img
                  src={avatarSrc}
                  alt={t("header.profileTitle")}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    const target = event.currentTarget;
                    if (target.dataset.fallback === "1") return;
                    target.dataset.fallback = "1";
                    target.src = "/noimage1.jpg";
                  }}
                />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-[70] min-w-[180px] rounded-lg border border-border bg-card shadow-lg p-2"
            >
              <div className="px-3 py-2 text-sm text-foreground">
                {displayLabel || t("header.userFallback")}
              </div>
              {showSplitOption && (
                <DropdownMenu.Item
                  className="cursor-pointer select-none rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                  onSelect={(event) => {
                    event.preventDefault();
                    handleSplitViewClick();
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span>{t("header.splitView")}</span>
                    <span
                      role="switch"
                      aria-checked={splitViewEnabled}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        splitViewEnabled ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-background transition-transform ${
                          splitViewEnabled ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </span>
                  </div>
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item
                className={`select-none rounded-md px-3 py-2 text-sm ${
                  canToggleProfileSetup
                    ? "cursor-pointer text-foreground hover:bg-muted"
                    : "cursor-not-allowed text-muted-foreground bg-muted/30"
                }`}
                onSelect={(event) => {
                  event.preventDefault();
                  if (!canToggleProfileSetup) return;
                  handleProfileSetupToggle();
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <span>{t("header.setupProfile")}</span>
                  <span
                    role="switch"
                    aria-checked={profileSetupVisible}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      profileSetupVisible && canToggleProfileSetup ? "bg-primary" : "bg-muted"
                    } ${canToggleProfileSetup ? "" : "opacity-60"}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-background transition-transform ${
                        profileSetupVisible ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </span>
                </div>
              </DropdownMenu.Item>
              <div className="px-3 py-2 text-xs text-muted-foreground">{t("header.theme")}</div>
              <DropdownMenu.Item
                className="cursor-pointer select-none rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                onSelect={(event) => {
                  event.preventDefault();
                  handleThemeToggle();
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <span>{themeMode === "dark" ? t("header.dark") : t("header.light")}</span>
                  <span
                    role="switch"
                    aria-checked={themeMode === "light"}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      themeMode === "light" ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-background transition-transform ${
                        themeMode === "light" ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </span>
                </div>
              </DropdownMenu.Item>
              <DropdownMenu.Sub open={languageMenuOpen} onOpenChange={setLanguageMenuOpen}>
                <DropdownMenu.SubTrigger className="cursor-pointer select-none rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center justify-between gap-4">
                  <span>{t("header.language")}</span>
                  <span className="text-muted-foreground">◀</span>
                </DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent
                  side="left"
                  align="start"
                  sideOffset={8}
                  className="z-[80] min-w-[160px] rounded-lg border border-border bg-card shadow-lg p-1"
                >
                  <DropdownMenu.Item
                    className="cursor-pointer select-none rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center justify-between"
                    onSelect={(event) => {
                      event.preventDefault();
                      handleLanguageSelect("id");
                    }}
                  >
                    <span>{t("header.languageIndonesian")}</span>
                    {i18n.language === "id" && <span className="text-primary">✓</span>}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="cursor-pointer select-none rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center justify-between"
                    onSelect={(event) => {
                      event.preventDefault();
                      handleLanguageSelect("en");
                    }}
                  >
                    <span>{t("header.languageEnglish")}</span>
                    {i18n.language === "en" && <span className="text-primary">✓</span>}
                  </DropdownMenu.Item>
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
              <DropdownMenu.Separator className="my-2 h-px bg-border" />
              <DropdownMenu.Item
                className="cursor-pointer select-none rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                onSelect={(event) => {
                  event.preventDefault();
                  handleSignOut();
                }}
              >
                {t("actions.signOut")}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
