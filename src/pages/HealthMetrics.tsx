import React, { useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { HealthMetricsProvider, useHealthMetrics } from "@/contexts/HealthMetricsContext";
import { useTranslation } from "react-i18next";

const MAX_IMAGE_SIZE = 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);

type TabKey = "bmi" | "body-fat" | "tdee" | "burned" | "heart";

const activityOptions = [
  { key: "sedentary", value: 1.2 },
  { key: "light", value: 1.375 },
  { key: "moderate", value: 1.55 },
  { key: "active", value: 1.725 },
  { key: "extraActive", value: 1.9 },
];

const metActivities = [
  { key: "walkingSlow", met: 2.5 },
  { key: "walkingBrisk", met: 3.8 },
  { key: "jogging", met: 7.0 },
  { key: "cyclingModerate", met: 6.8 },
  { key: "swimming", met: 6.0 },
  { key: "strengthTraining", met: 5.0 },
  { key: "yoga", met: 3.0 },
  { key: "basketball", met: 8.0 },
];

const heartZoneConfig = [
  { key: "recovery", min: 0.5, max: 0.6 },
  { key: "fatBurn", min: 0.6, max: 0.7 },
  { key: "aerobic", min: 0.7, max: 0.8 },
  { key: "threshold", min: 0.8, max: 0.9 },
  { key: "maximum", min: 0.9, max: 1.0 },
];

const numberOrZero = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);

interface HealthMetricsContentProps {
  embedded?: boolean;
}

const HealthMetricsContent: React.FC<HealthMetricsContentProps> = ({ embedded = false }) => {
  const { t } = useTranslation();
  const { user, loading, signInWithGoogle } = useAuth();
  const { profile, isLoading: profileLoading, error: profileError, saveProfile } = useProfile(Boolean(user));
  const { age, weight, height, gender, setAge, setWeight, setHeight, setGender } = useHealthMetrics();

  const [activeTab, setActiveTab] = useState<TabKey>("bmi");
  const [activityLevel, setActivityLevel] = useState(activityOptions[1].value);
  const [username, setUsername] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string>("/noimage1.jpg");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  const [burnDuration, setBurnDuration] = useState("30");
  const [burnActivityKey, setBurnActivityKey] = useState(metActivities[0]?.key ?? "walkingSlow");
  const [burnList, setBurnList] = useState<Array<{ key: string; met: number; minutes: number }>>([]);
  const [selectedBurnIndices, setSelectedBurnIndices] = useState<number[]>([]);
  const [forceReady, setForceReady] = useState(false);

  const burnActivity = useMemo(
    () => metActivities.find((item) => item.key === burnActivityKey) ?? metActivities[0],
    [burnActivityKey],
  );

  useEffect(() => {
    if (!profile || hasHydrated) return;
    if (profile.age) setAge(profile.age);
    if (profile.weight) setWeight(profile.weight);
    if (profile.height) setHeight(profile.height);
    if (profile.gender === "female" || profile.gender === "male") setGender(profile.gender);
    if (profile.username) setUsername(profile.username);
    if (profile.photoUrl) setPhotoPreview(profile.photoUrl);
    setHasHydrated(true);
  }, [profile, hasHydrated, setAge, setWeight, setHeight, setGender]);

  useEffect(() => {
    if (!profileLoading && !hasHydrated) {
      setHasHydrated(true);
    }
  }, [profileLoading, hasHydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const loadSetting = () => {
      try {
        setShowProfileSetup(localStorage.getItem("profile-setup-visible") === "true");
      } catch {
        setShowProfileSetup(false);
      }
    };
    loadSetting();
    const handleToggle = () => loadSetting();
    window.addEventListener("profile-setup-toggle", handleToggle);
    window.addEventListener("storage", handleToggle);
    return () => {
      window.removeEventListener("profile-setup-toggle", handleToggle);
      window.removeEventListener("storage", handleToggle);
    };
  }, []);

  useEffect(() => {
    if (profileLoading) return;
    if (!profile) {
      setShowProfileSetup(true);
      try {
        localStorage.setItem("profile-setup-visible", "true");
      } catch {
        // ignore storage failures
      }
    }
  }, [profile, profileLoading]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setForceReady(true);
    }, 4000);
    return () => clearTimeout(timeoutId);
  }, []);

  const profileSnapshot = useMemo(
    () => ({
      age: profile?.age ?? 18,
      weight: profile?.weight ?? 60,
      height: profile?.height ?? 165,
      gender: profile?.gender ?? "male",
      username: profile?.username ?? "",
      photoUrl: profile?.photoUrl ?? "",
    }),
    [profile],
  );

  const isDirty = useMemo(() => {
    if (!hasHydrated) return false;
    if (photoDataUrl) return true;
    return (
      age !== profileSnapshot.age ||
      weight !== profileSnapshot.weight ||
      height !== profileSnapshot.height ||
      gender !== profileSnapshot.gender ||
      username !== profileSnapshot.username
    );
  }, [age, weight, height, gender, username, photoDataUrl, profileSnapshot, hasHydrated]);

  const isProfileValid = useMemo(() => {
    if (!age || age <= 0) return false;
    if (!weight || weight <= 0) return false;
    if (!height || height <= 0) return false;
    if (gender !== "male" && gender !== "female") return false;
    return true;
  }, [age, weight, height, gender]);

  const handlePhotoChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      window.alert(t("health.profile.invalidImageType"));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      window.alert(t("health.profile.imageTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setPhotoPreview(result);
      setPhotoDataUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!user || isSaving || !isDirty || !isProfileValid) return;
    setIsSaving(true);
    try {
      await saveProfile({
        age,
        weight,
        height,
        gender,
        username,
        photoUrl: photoDataUrl ?? undefined,
      });
      setPhotoDataUrl(null);
      toast.success(t("health.profileSaved"));
    } catch (error) {
      console.error("Profile save failed:", error);
      toast.error(t("health.profileSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const bmi = useMemo(() => {
    if (!height || !weight) return 0;
    const h = height / 100;
    return weight / (h * h);
  }, [height, weight]);

  const bmiCategory = useMemo(() => {
    if (bmi === 0) return t("health.bmi.empty");
    if (bmi < 18.5) return t("health.bmi.categories.underweight");
    if (bmi < 25) return t("health.bmi.categories.normal");
    if (bmi < 30) return t("health.bmi.categories.overweight");
    return t("health.bmi.categories.obese");
  }, [bmi, t]);

  const bmiScaleMax = 45;
  const bmiPercent = useMemo(() => {
    if (!bmi) return 0;
    const clamped = Math.min(Math.max(bmi, 0), bmiScaleMax);
    return (clamped / bmiScaleMax) * 100;
  }, [bmi]);

  const bmiMarker = useMemo(() => {
    const clamped = Math.min(Math.max(bmiPercent, 2), 98);
    return clamped;
  }, [bmiPercent]);

  const bmiSegment = useMemo(() => {
    const total = bmiScaleMax;
    return {
      under: (18.5 / total) * 100,
      normal: ((24.9 - 18.5) / total) * 100,
      over: ((29.9 - 25) / total) * 100,
      obese: ((39.9 - 30) / total) * 100,
      morbid: ((total - 40) / total) * 100,
    };
  }, []);

  const bmiSegmentWidths = useMemo(
    () => [
      { key: "under", label: t("health.bmi.segments.under"), color: "bg-blue-500", width: bmiSegment.under },
      { key: "normal", label: t("health.bmi.segments.normal"), color: "bg-emerald-500", width: bmiSegment.normal },
      { key: "over", label: t("health.bmi.segments.over"), color: "bg-amber-400", width: bmiSegment.over },
      { key: "obese", label: t("health.bmi.segments.obese"), color: "bg-orange-500", width: bmiSegment.obese },
      { key: "morbid", label: t("health.bmi.segments.morbid"), color: "bg-red-600", width: bmiSegment.morbid },
    ],
    [bmiSegment, t],
  );

  const idealRange = useMemo(() => {
    if (!height) return { min: 0, max: 0 };
    const h = height / 100;
    return { min: 18.5 * h * h, max: 24.9 * h * h };
  }, [height]);

  const bodyFat = useMemo(() => {
    if (!age || !bmi) return 0;
    const genderValue = gender === "male" ? 1 : 0;
    return 1.2 * bmi + 0.23 * age - 10.8 * genderValue - 5.4;
  }, [age, bmi, gender]);

  const bodyFatCategory = useMemo(() => {
    if (!bodyFat) return t("health.bodyFat.empty");
    if (bodyFat < 18) return t("health.bodyFat.categories.low");
    if (bodyFat < 25) return t("health.bodyFat.categories.normal");
    return t("health.bodyFat.categories.high");
  }, [bodyFat, t]);

  const bodyFatScaleMax = 40;
  const bodyFatSegments = useMemo(() => {
    const total = bodyFatScaleMax;
    return {
      low: (18 / total) * 100,
      normal: ((25 - 18) / total) * 100,
      high: ((total - 25) / total) * 100,
    };
  }, []);

  const bodyFatSegmentWidths = useMemo(
    () => [
      {
        key: "low",
        label: t("health.bodyFat.segments.low"),
        range: t("health.bodyFat.segmentRanges.low"),
        color: "bg-blue-500",
        width: bodyFatSegments.low,
      },
      {
        key: "normal",
        label: t("health.bodyFat.segments.normal"),
        range: t("health.bodyFat.segmentRanges.normal"),
        color: "bg-emerald-500",
        width: bodyFatSegments.normal,
      },
      {
        key: "high",
        label: t("health.bodyFat.segments.high"),
        range: t("health.bodyFat.segmentRanges.high"),
        color: "bg-orange-500",
        width: bodyFatSegments.high,
      },
    ],
    [bodyFatSegments, t],
  );

  const bmr = useMemo(() => {
    if (!age || !weight || !height) return 0;
    if (gender === "male") {
      return 10 * weight + 6.25 * height - 5 * age + 5;
    }
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }, [age, weight, height, gender]);

  const maintenanceCalories = bmr * activityLevel;

  const addBurnActivity = () => {
    const minutes = numberOrZero(burnDuration);
    if (minutes <= 0) return;
    setBurnList((prev) => [...prev, { key: burnActivity.key, met: burnActivity.met, minutes }]);
  };

  const toggleBurnSelection = (index: number) => {
    setSelectedBurnIndices((prev) =>
      prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index],
    );
  };

  const removeSelectedBurn = () => {
    if (selectedBurnIndices.length === 0) return;
    setBurnList((prev) => prev.filter((_, itemIndex) => !selectedBurnIndices.includes(itemIndex)));
    setSelectedBurnIndices([]);
  };

  const totalBurned = useMemo(() => {
    return burnList.reduce((sum, entry) => {
      const calories = (entry.met * 3.5 * weight) / 200 * entry.minutes;
      return sum + calories;
    }, 0);
  }, [burnList, weight]);

  const hasBurnSelection = selectedBurnIndices.length > 0;

  const heartZones = useMemo(() => {
    const max = 220 - age;
    return heartZoneConfig.map((zone) => ({
      label: t(`health.heart.zones.${zone.key}`),
      min: Math.round(max * zone.min),
      max: Math.round(max * zone.max),
      desc: t(`health.heart.descriptions.${zone.key}`),
    }));
  }, [age, t]);

  const pageHeightClass = embedded ? "h-full" : "min-h-screen";

  if (loading && !forceReady) {
    return (
      <div className={`${pageHeightClass} bg-background flex items-center justify-center`}>
        <div className="text-center">
          <img
            src="/bmicalico1.png"
            alt={t("loading.healthMetrics")}
            className="w-20 h-20 mx-auto animate-pulse mb-4 object-contain"
          />
          <p className="text-muted-foreground text-tv-body">{t("loading.healthMetrics")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const redirectPath = embedded ? "/kalkulator-bmi" : "/health-metrics";
    return (
      <div className={`${pageHeightClass} bg-background flex items-center justify-center p-6`}>
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center">
          <h2 className="text-tv-subtitle text-foreground mb-2">{t("health.loginRequiredTitle")}</h2>
          <p className="text-tv-body text-muted-foreground mb-6">
            {t("health.loginRequiredBody")}
          </p>
          <Button
            size="lg"
            onClick={async () => {
              const { error } = await signInWithGoogle();
              if (!error) {
                window.location.assign(redirectPath);
              } else {
                window.alert(t("header.googleLoginFailed"));
              }
            }}
            className="w-full"
          >
            {t("actions.loginGoogle")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${pageHeightClass} bg-background`}>
      {!embedded && <Header />}

      <main className={embedded ? "h-full overflow-y-auto py-6" : "pt-24 md:pt-28 lg:pt-32 pb-10"}>
        <div className={`${embedded ? "px-4" : "container mx-auto px-4"} space-y-6`}>
          {isSaving && (
            <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center">
              <div className="bg-card border border-border rounded-xl px-6 py-4 shadow-xl flex items-center gap-3">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-tv-body text-foreground">{t("health.profileSaving")}</span>
              </div>
            </div>
          )}

          <div className={embedded ? "bg-background border-b border-border" : "bg-background border-b border-border rounded-2xl shadow-md"}>
            <div className="px-4">
              <div className="flex gap-2 md:gap-4 py-3 md:py-4 flex-wrap">
              {[
                { key: "bmi", label: t("health.tabs.bmi") },
                { key: "body-fat", label: t("health.tabs.bodyFat") },
                { key: "tdee", label: t("health.tabs.tdee") },
                { key: "burned", label: t("health.tabs.burned") },
                { key: "heart", label: t("health.tabs.heart") },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as TabKey)}
                  className={`flex-1 py-3 md:py-4 px-4 md:px-6 rounded-lg text-tv-body font-medium transition-all duration-200 touch-target focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background whitespace-nowrap overflow-hidden text-ellipsis ${
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              </div>
            </div>
          </div>

          {showProfileSetup && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
              {profileLoading && (
                <div className="space-y-4">
                  <div className="h-6 w-56 rounded-md bg-muted animate-pulse" />
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-12 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                  <div className="h-20 rounded-lg bg-muted animate-pulse" />
                </div>
              )}
              {!profileLoading && (
                <>
                  {profileError ? (
                    <div className="mb-4 rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                      {t("health.profileLoadFailed")}
                    </div>
                  ) : !profile ? (
                    <div className="mb-4 rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                      {t("health.profileCompleteHint")}
                    </div>
                  ) : null}
                  <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      <label className="block">
                        <span className="text-tv-small text-muted-foreground">{t("health.profile.age")}</span>
                        <input
                          type="number"
                          min={1}
                          value={age}
                          onChange={(event) => setAge(Number(event.target.value))}
                          className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground"
                        />
                      </label>
                      <label className="block">
                        <span className="text-tv-small text-muted-foreground">{t("health.profile.weight")}</span>
                        <input
                          type="number"
                          min={1}
                          value={weight}
                          onChange={(event) => setWeight(Number(event.target.value))}
                          className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground"
                        />
                      </label>
                      <label className="block">
                        <span className="text-tv-small text-muted-foreground">{t("health.profile.height")}</span>
                        <input
                          type="number"
                          min={1}
                          value={height}
                          onChange={(event) => setHeight(Number(event.target.value))}
                          className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground"
                        />
                      </label>
                      <label className="block">
                        <span className="text-tv-small text-muted-foreground">{t("health.profile.gender")}</span>
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            variant={gender === "male" ? "default" : "secondary"}
                            onClick={() => setGender("male")}
                            className="flex-1"
                          >
                            {t("health.profile.male")}
                          </Button>
                          <Button
                            type="button"
                            variant={gender === "female" ? "default" : "secondary"}
                            onClick={() => setGender("female")}
                            className="flex-1"
                          >
                            {t("health.profile.female")}
                          </Button>
                        </div>
                      </label>
                    </div>

                    <div className="w-full lg:w-64 flex flex-col gap-4">
                      <label className="block">
                        <span className="text-tv-small text-muted-foreground">{t("health.profile.username")}</span>
                        <input
                          value={username}
                          onChange={(event) => setUsername(event.target.value)}
                          className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground"
                        />
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                          <img
                            src={photoPreview}
                            alt={t("header.profileTitle")}
                            className="w-full h-full object-cover"
                            onError={(event) => {
                              const target = event.currentTarget;
                              if (target.dataset.fallback === "1") return;
                              target.dataset.fallback = "1";
                              target.src = "/noimage1.jpg";
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-tv-small text-muted-foreground">
                            {t("health.profile.photo")}
                          </label>
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={handlePhotoChange}
                            className="mt-2 w-full text-sm text-muted-foreground"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleSaveProfile}
                        disabled={!isDirty || isSaving || !isProfileValid}
                        variant={isDirty && isProfileValid ? "default" : "secondary"}
                      >
                        {isSaving ? t("health.profile.saving") : t("health.profile.save")}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "bmi" && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-tv-small text-muted-foreground">{t("health.bmi.label")}</p>
                  <p className="text-tv-title font-bold text-primary">{bmi ? bmi.toFixed(1) : t("health.bmi.empty")}</p>
                </div>
                <div>
                  <p className="text-tv-small text-muted-foreground">{t("health.bmi.categoryLabel")}</p>
                  <p className="text-tv-subtitle text-foreground">{bmiCategory}</p>
                </div>
              </div>
              <div className="relative pt-[56px]">
                {bmi > 0 && (
                  <div
                    className="absolute top-0 flex flex-col items-center"
                    style={{ left: `${bmiMarker}%`, transform: "translateX(-50%)" }}
                  >
                    <span className="text-2xl text-foreground font-bold leading-none">{bmi.toFixed(1)}</span>
                    <div
                      className="h-0 w-0 border-l-[18px] border-r-[18px] border-t-[24px] border-l-transparent border-r-transparent border-t-white"
                      aria-hidden="true"
                    />
                  </div>
                )}
                <div className="h-4 rounded-full bg-muted overflow-hidden">
                  <div className="flex h-full">
                    <div className="bg-blue-500" style={{ width: `${bmiSegment.under}%` }} />
                    <div className="bg-emerald-500" style={{ width: `${bmiSegment.normal}%` }} />
                    <div className="bg-amber-400" style={{ width: `${bmiSegment.over}%` }} />
                    <div className="bg-orange-500" style={{ width: `${bmiSegment.obese}%` }} />
                    <div className="bg-red-600" style={{ width: `${bmiSegment.morbid}%` }} />
                  </div>
                </div>
              </div>
              <div className="flex text-xs text-muted-foreground">
                {bmiSegmentWidths.map((segment) => (
                  <div
                    key={segment.key}
                    className="flex items-center gap-2"
                    style={{ width: `${segment.width}%` }}
                  >
                    <span className={`h-2 w-2 rounded-full ${segment.color}`} />
                    <span className="truncate">{segment.label}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-tv-small text-muted-foreground">{t("health.bmi.idealWeightRange")}</p>
                <p className="text-tv-body text-foreground">
                  {t("health.bmi.range", { min: idealRange.min.toFixed(1), max: idealRange.max.toFixed(1) })}
                </p>
              </div>
            </div>
          )}

          {activeTab === "body-fat" && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-tv-small text-muted-foreground">{t("health.bodyFat.label")}</p>
                  <p className="text-tv-title font-bold text-primary">
                    {bodyFat ? bodyFat.toFixed(1) : t("health.bodyFat.empty")}%
                  </p>
                </div>
                <div>
                  <p className="text-tv-small text-muted-foreground">{t("health.bodyFat.categoryLabel")}</p>
                  <p className="text-tv-subtitle text-foreground">{bodyFatCategory}</p>
                </div>
              </div>
              <div className="relative pt-[56px]">
                {bodyFat > 0 && (
                  <div
                    className="absolute top-0 flex flex-col items-center"
                    style={{
                      left: `${Math.min(Math.max((bodyFat / 40) * 100, 2), 98)}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <span className="text-2xl text-foreground font-bold leading-none">
                      {bodyFat.toFixed(1)}
                    </span>
                    <div
                      className="h-0 w-0 border-l-[18px] border-r-[18px] border-t-[24px] border-l-transparent border-r-transparent border-t-white"
                      aria-hidden="true"
                    />
                  </div>
                )}
                <div className="h-4 rounded-full bg-muted overflow-hidden">
                  <div className="flex h-full">
                    <div className="bg-blue-500" style={{ width: `${bodyFatSegments.low}%` }} />
                    <div className="bg-emerald-500" style={{ width: `${bodyFatSegments.normal}%` }} />
                    <div className="bg-orange-500" style={{ width: `${bodyFatSegments.high}%` }} />
                  </div>
                </div>
              </div>
              <div className="flex text-xs text-muted-foreground">
                {bodyFatSegmentWidths.map((segment) => (
                  <div
                    key={segment.key}
                    className="flex items-center gap-2"
                    style={{ width: `${segment.width}%` }}
                  >
                    <span className={`h-2 w-2 rounded-full ${segment.color}`} />
                    <span className="truncate">
                      {segment.label} {segment.range}
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-tv-small text-muted-foreground">{t("health.bodyFat.leanMass")}</p>
                  <p className="text-tv-body font-semibold">
                    {weight ? (weight * (1 - bodyFat / 100)).toFixed(1) : t("health.bodyFat.empty")} {t("units.kg")}
                  </p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-tv-small text-muted-foreground">{t("health.bodyFat.fatMass")}</p>
                  <p className="text-tv-body font-semibold">
                    {weight ? (weight * (bodyFat / 100)).toFixed(1) : t("health.bodyFat.empty")} {t("units.kg")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "tdee" && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-md space-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <p className="text-tv-small text-muted-foreground">{t("health.tdee.activityLevel")}</p>
                  <select
                    value={activityLevel}
                    onChange={(event) => setActivityLevel(Number(event.target.value))}
                    className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground"
                  >
                    {activityOptions.map((option) => (
                      <option key={option.key} value={option.value}>
                        {t(`health.tdee.activityOptions.${option.key}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-tv-small text-muted-foreground">{t("health.tdee.bmr")}</p>
                  <p className="text-tv-title font-bold text-primary">{Math.round(bmr)}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-tv-small text-muted-foreground">{t("health.tdee.maintenance")}</p>
                  <p className="text-tv-body font-semibold">{Math.round(maintenanceCalories)}</p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-tv-small text-muted-foreground">{t("health.tdee.smoothLoss")}</p>
                  <p className="text-tv-body font-semibold">
                    {Math.round(maintenanceCalories - 250)}
                  </p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-tv-small text-muted-foreground">{t("health.tdee.fastLoss")}</p>
                  <p className="text-tv-body font-semibold">
                    {Math.round(maintenanceCalories - 500)}
                  </p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-tv-small text-muted-foreground">{t("health.tdee.smoothGain")}</p>
                  <p className="text-tv-body font-semibold">
                    {Math.round(maintenanceCalories + 250)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "burned" && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-md space-y-4 relative">
              <div>
                <p className="text-tv-small text-muted-foreground">{t("health.burned.title")}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-tv-small text-muted-foreground">{t("health.burned.activity")}</span>
                  <select
                    value={burnActivityKey}
                    onChange={(event) => {
                      const next = metActivities.find((item) => item.key === event.target.value);
                      if (next) setBurnActivityKey(next.key);
                    }}
                    className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground"
                  >
                    {metActivities.map((item) => (
                      <option key={item.key} value={item.key}>
                        {t(`health.burned.activities.${item.key}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-tv-small text-muted-foreground">{t("health.burned.duration")}</span>
                  <input
                    type="number"
                    min={1}
                    value={burnDuration}
                    onChange={(event) => setBurnDuration(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground"
                  />
                </label>
              </div>
              <div className="space-y-2">
                {burnList.map((entry, index) => {
                  const isSelected = selectedBurnIndices.includes(index);
                  return (
                    <div
                      key={`${entry.key}-${index}`}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      onClick={() => toggleBurnSelection(index)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleBurnSelection(index);
                        }
                      }}
                      className={`flex items-center justify-between rounded-lg p-3 transition cursor-pointer ${
                        isSelected
                          ? "bg-muted ring-2 ring-primary/60"
                          : "bg-muted/50 ring-1 ring-transparent hover:bg-muted/70 hover:ring-primary/30"
                      }`}
                    >
                      <span>
                        {t(`health.burned.activities.${entry.key}`)}{" "}
                        <span className="text-muted-foreground">
                          ({entry.minutes} {t("units.min")})
                        </span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span>
                          {Math.round((entry.met * 3.5 * weight) / 200 * entry.minutes)} {t("units.kcal")}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {burnList.length === 0 && (
                  <div className="text-sm text-muted-foreground">{t("health.burned.none")}</div>
                )}
              </div>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-tv-small text-muted-foreground">{t("health.burned.total")}</p>
                <p className="text-tv-title font-bold text-primary">{Math.round(totalBurned)}</p>
              </div>

              <button
                type="button"
                onClick={hasBurnSelection ? removeSelectedBurn : addBurnActivity}
                className={`fixed bottom-8 right-8 rounded-full shadow-lg flex items-center justify-center transition ${
                  hasBurnSelection
                    ? "h-12 px-6 bg-rose-500/90 text-white hover:bg-rose-500"
                    : "h-12 w-12 bg-primary text-primary-foreground hover:bg-primary/90 text-xl"
                }`}
                title={hasBurnSelection ? t("health.burned.removeSelected") : t("health.burned.addActivity")}
              >
                {hasBurnSelection ? t("health.burned.remove") : "+"}
              </button>
            </div>
          )}

          {activeTab === "heart" && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-md space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {heartZones.map((zone) => (
                  <div key={zone.label} className="bg-muted rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-tv-small text-muted-foreground">{zone.label}</p>
                    <p className="text-tv-body font-semibold">
                      {zone.min} - {zone.max} {t("units.bpm")}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{zone.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-tv-small text-muted-foreground">{t("health.heart.maximum")}</p>
              <p className="text-tv-title font-bold text-primary">{220 - age} {t("units.bpm")}</p>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
};

const HealthMetrics: React.FC = () => (
  <HealthMetricsProvider>
    <HealthMetricsContent />
  </HealthMetricsProvider>
);

export const HealthMetricsEmbedded: React.FC = () => (
  <HealthMetricsProvider>
    <HealthMetricsContent embedded />
  </HealthMetricsProvider>
);

export default HealthMetrics;






