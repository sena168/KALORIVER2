import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { CalorieProvider } from '@/contexts/CalorieContext';
import Header from '@/components/Header';
import CategoryTabs from '@/components/CategoryTabs';
import FoodMenu from '@/components/FoodMenu';
import BottomBar from '@/components/BottomBar';
import { useMenuData } from '@/hooks/useMenuData';
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import type { ItemQuantity } from "@/hooks/useCalorieState";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Link } from "react-router-dom";

const GUEST_CALORIE_KEY = "calorie-quantities-guest";
const userCalorieKey = (uid: string) => `calorie-quantities:${uid}`;
const readStoredQuantities = (key: string): ItemQuantity => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
};

const readStoredWithFlag = (key: string): { data: ItemQuantity; hasKey: boolean } => {
  if (typeof window === "undefined") return { data: {}, hasKey: false };
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return { data: {}, hasKey: false };
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (!parsed || typeof parsed !== "object") return { data: {}, hasKey: true };
    return { data: parsed, hasKey: true };
  } catch {
    return { data: {}, hasKey: true };
  }
};

interface CalculatorContentProps {
  embedded?: boolean;
}

export const CalculatorContent: React.FC<CalculatorContentProps> = ({ embedded = false }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile, isLoading: profileLoading, saveProfile } = useProfile(Boolean(user));
  const { categories: menuData, isLoading, refetch } = useMenuData({ includeHidden: false });
  const [activeCategory, setActiveCategory] = useState<string>(menuData[0]?.id || 'makanan-utama');
  const [guestQuantities, setGuestQuantities] = useState<ItemQuantity>(() =>
    readStoredQuantities(GUEST_CALORIE_KEY),
  );
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCalories, setCustomCalories] = useState("");
  const [customImagePreview, setCustomImagePreview] = useState("");
  const [customImageDataUrl, setCustomImageDataUrl] = useState("");
  const [customBusy, setCustomBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setGuestQuantities(readStoredQuantities(GUEST_CALORIE_KEY));
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (!profile?.calorieQuantities) return;
    try {
      window.localStorage.setItem(userCalorieKey(user.uid), JSON.stringify(profile.calorieQuantities));
      window.dispatchEvent(new Event("calorie-quantities-updated"));
    } catch {
      // ignore storage failures
    }
  }, [user, profile?.calorieQuantities]);

  const categoriesForTabs = useMemo(() => {
    if (!user) return menuData;
    if (menuData.some((category) => category.id === "custom")) return menuData;
    return [
      ...menuData,
      {
        id: "custom",
        label: "Custom",
        items: [],
      },
    ];
  }, [menuData, user]);

  useEffect(() => {
    if (!categoriesForTabs.find((category) => category.id === activeCategory) && categoriesForTabs.length > 0) {
      setActiveCategory(categoriesForTabs[0].id);
    }
  }, [categoriesForTabs, activeCategory]);

  const handleCategoryChange = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
  }, []);

  const activeItems = useMemo(() => {
    const category = categoriesForTabs.find(cat => cat.id === activeCategory);
    return category?.items || [];
  }, [categoriesForTabs, activeCategory]);
  const isPremium = Boolean(user && profile?.isPremium);
  const canManageCustom = isPremium && activeCategory === "custom";
  const isCustomTab = activeCategory === "custom";

  const getAuthHeaders = useCallback(async () => {
    if (!user) throw new Error("Not authenticated");
    const token = await user.getIdToken(true);
    return { Authorization: `Bearer ${token}` };
  }, [user]);

  const handleCustomImageChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      toast.error(t("customMenu.errors.imageType"));
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error(t("customMenu.errors.imageSize"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      setCustomImagePreview(value);
      setCustomImageDataUrl(value);
    };
    reader.readAsDataURL(file);
  };

  const resetCustomForm = () => {
    setCustomName("");
    setCustomCalories("");
    setCustomImagePreview("");
    setCustomImageDataUrl("");
  };

  const handleSaveCustomMenu = async () => {
    if (!user || customBusy) return;
    const calories = Number(customCalories);
    if (!customName.trim()) {
      toast.error(t("customMenu.errors.nameRequired"));
      return;
    }
    if (!Number.isFinite(calories) || calories < 0) {
      toast.error(t("customMenu.errors.caloriesInvalid"));
      return;
    }
    setCustomBusy(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/custom-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          name: customName.trim(),
          calories,
          imagePath: customImageDataUrl || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          typeof data?.error === "string" ? data.error : t("customMenu.errors.saveFailed");
        throw new Error(message);
      }
      await refetch();
      resetCustomForm();
      setShowCustomModal(false);
      toast.success(t("customMenu.messages.saved"));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("customMenu.errors.saveFailed"));
    } finally {
      setCustomBusy(false);
    }
  };

  const handleDeleteCustomItem = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/custom-menu", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const message =
            typeof data?.error === "string" ? data.error : t("customMenu.errors.deleteFailed");
          throw new Error(message);
        }
        await refetch();
        toast.success(t("customMenu.messages.deleted"));
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : t("customMenu.errors.deleteFailed"));
      }
    },
    [user, getAuthHeaders, refetch, t],
  );

  const userStored = user ? readStoredWithFlag(userCalorieKey(user.uid)) : { data: {}, hasKey: false };
  const initialQuantities = user
    ? userStored.hasKey
      ? userStored.data
      : profile?.calorieQuantities ?? (profileLoading ? guestQuantities : {})
    : guestQuantities;
  const hydrateKey = user ? `${user.uid}:${profile?.id ?? "none"}` : "guest";
  const persistQuantities = useCallback(
    (next: ItemQuantity) => {
      const hasItems = Object.keys(next).length > 0;
      if (user) {
        const dirtyKey = `calorie-quantities-dirty:${user.uid}`;
        const savedKey = `calorie-quantities-saved:${user.uid}`;
        const serializedNext = JSON.stringify(next);
        try {
          const savedSnapshot = window.localStorage.getItem(savedKey);
          const isSavedSnapshot = savedSnapshot === serializedNext;
          window.localStorage.setItem(userCalorieKey(user.uid), serializedNext);
          window.localStorage.setItem(dirtyKey, isSavedSnapshot ? "false" : "true");
          window.dispatchEvent(new Event("calorie-quantities-updated"));
        } catch {
          // ignore storage failures
        }
        if (!hasItems) {
          try {
            window.localStorage.setItem(savedKey, serializedNext);
            window.localStorage.setItem(dirtyKey, "false");
          } catch {
            // ignore storage failures
          }
          void saveProfile({ calorieQuantities: next });
        }
        return;
      }
      try {
        window.localStorage.setItem(GUEST_CALORIE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event("calorie-quantities-updated"));
      } catch {
        // ignore storage failures
      }
      setGuestQuantities(next);
    },
    [user, saveProfile],
  );

  if (isLoading) {
    return (
      <div className={`${embedded ? "h-full" : "min-h-screen"} bg-background flex items-center justify-center`}>
        <div className="text-center">
          <img
            src="/bmicalico1.png"
            alt={t("loading.calculator")}
            className="w-20 h-20 mx-auto animate-pulse mb-4 object-contain"
          />
          <p className="text-muted-foreground text-tv-body">{t("loading.calculator")}</p>
        </div>
      </div>
    );
  }

  return (
    <CalorieProvider
      initialQuantities={initialQuantities}
      hydrateKey={hydrateKey}
      onPersist={persistQuantities}
      persistDelayMs={0}
    >
      <div className={`${embedded ? "h-full" : "h-screen"} flex flex-col overflow-hidden bg-background`}>
        {/* Fixed Header */}
        {!embedded && <Header />}
        
        {/* Fixed Category Tabs */}
        <CategoryTabs
          categories={categoriesForTabs}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          embedded={embedded}
        />
        
        {/* Scrollable Menu Content */}
        {/* Spacing: header (16-24) + tabs (~60-72) + bottom bar (20-28) */}
        <main
          className={
            embedded
              ? "flex flex-col flex-1 min-h-0 mt-4"
              : "flex flex-col flex-1 min-h-0 mt-[8.5rem] md:mt-[10rem] lg:mt-[12rem] mb-20 md:mb-24 lg:mb-28"
          }
        >
          {canManageCustom && (
            <div className={`${embedded ? "px-2 pb-2" : "container mx-auto px-4 pb-2"} flex justify-end`}>
              <Button onClick={() => setShowCustomModal(true)}>{t("customMenu.addButton")}</Button>
            </div>
          )}
          {isCustomTab && user && !isPremium && (
            <div className={`${embedded ? "px-2 pb-2" : "container mx-auto px-4 pb-2"}`}>
              <div className="rounded-xl border border-border bg-card p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-tv-body text-foreground">{t("customMenu.upgradeTitle")}</p>
                  <p className="text-tv-small text-muted-foreground">{t("customMenu.upgradeSubtitle")}</p>
                </div>
                <Button asChild>
                  <Link to="/payment">{t("customMenu.upgradeButton")}</Link>
                </Button>
              </div>
            </div>
          )}
          <FoodMenu
            items={activeItems}
            categoryId={activeCategory}
            embedded={embedded}
            allowCustomDelete={canManageCustom}
            onDeleteCustomItem={handleDeleteCustomItem}
          />
        </main>
        
        {/* Fixed Bottom Bar */}
        <BottomBar embedded={embedded} />

        {showCustomModal && (
          <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 shadow-xl space-y-4">
              <h2 className="text-tv-subtitle text-foreground">{t("customMenu.modalTitle")}</h2>
              <label className="block">
                <span className="text-tv-small text-muted-foreground">{t("customMenu.fields.name")}</span>
                <input
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground"
                />
              </label>
              <label className="block">
                <span className="text-tv-small text-muted-foreground">{t("customMenu.fields.calories")}</span>
                <input
                  type="number"
                  min={0}
                  value={customCalories}
                  onChange={(event) => setCustomCalories(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-3 text-foreground"
                />
              </label>
              <label className="block">
                <span className="text-tv-small text-muted-foreground">{t("customMenu.fields.image")}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleCustomImageChange}
                  className="mt-2 w-full text-sm text-muted-foreground"
                />
              </label>
              {customImagePreview && (
                <div className="w-24 h-24 rounded-lg overflow-hidden border border-border">
                  <img src={customImagePreview} alt={t("customMenu.previewAlt")} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    resetCustomForm();
                    setShowCustomModal(false);
                  }}
                >
                  {t("actions.cancel")}
                </Button>
                <Button onClick={() => void handleSaveCustomMenu()} disabled={customBusy}>
                  {customBusy ? t("actions.saving") : t("actions.save")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CalorieProvider>
  );
};

const Calculator: React.FC = () => <CalculatorContent />;

export default Calculator;
