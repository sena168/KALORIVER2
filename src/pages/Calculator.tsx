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

interface CalculatorContentProps {
  embedded?: boolean;
}

export const CalculatorContent: React.FC<CalculatorContentProps> = ({ embedded = false }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile, saveProfile } = useProfile(Boolean(user));
  const { categories: menuData, isLoading } = useMenuData({ includeHidden: false });
  const [activeCategory, setActiveCategory] = useState<string>(menuData[0]?.id || 'makanan-utama');
  const [guestQuantities, setGuestQuantities] = useState<ItemQuantity>(() =>
    readStoredQuantities(GUEST_CALORIE_KEY),
  );

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

  useEffect(() => {
    if (!menuData.find((category) => category.id === activeCategory) && menuData.length > 0) {
      setActiveCategory(menuData[0].id);
    }
  }, [menuData, activeCategory]);

  const handleCategoryChange = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
  }, []);

  const activeItems = useMemo(() => {
    const category = menuData.find(cat => cat.id === activeCategory);
    return category?.items || [];
  }, [menuData, activeCategory]);

  const initialQuantities = user ? profile?.calorieQuantities ?? {} : guestQuantities;
  const hydrateKey = user ? `${user.uid}:${profile?.id ?? "none"}` : "guest";
  const persistQuantities = useCallback(
    (next: ItemQuantity) => {
      if (user) {
        try {
          window.localStorage.setItem(userCalorieKey(user.uid), JSON.stringify(next));
          window.dispatchEvent(new Event("calorie-quantities-updated"));
        } catch {
          // ignore storage failures
        }
        void saveProfile({ calorieQuantities: next });
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
      persistDelayMs={800}
    >
      <div className={`${embedded ? "h-full" : "h-screen"} flex flex-col overflow-hidden bg-background`}>
        {/* Fixed Header */}
        {!embedded && <Header />}
        
        {/* Fixed Category Tabs */}
        <CategoryTabs
          categories={menuData}
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
          <FoodMenu items={activeItems} categoryId={activeCategory} embedded={embedded} />
        </main>
        
        {/* Fixed Bottom Bar */}
        <BottomBar embedded={embedded} />
      </div>
    </CalorieProvider>
  );
};

const Calculator: React.FC = () => <CalculatorContent />;

export default Calculator;
