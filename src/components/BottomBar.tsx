import React, { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCalories } from '@/contexts/CalorieContext';
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

const dirtyKeyFor = (uid: string) => `calorie-quantities-dirty:${uid}`;
const savedKeyFor = (uid: string) => `calorie-quantities-saved:${uid}`;
const userCalorieKey = (uid: string) => `calorie-quantities:${uid}`;

interface BottomBarProps {
  embedded?: boolean;
}

const BottomBar: React.FC<BottomBarProps> = ({ embedded = false }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { saveProfile } = useProfile(Boolean(user));
  const { totalCalories, clearAll, quantities } = useCalories();
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const locale = i18n.language === "id" ? "id-ID" : i18n.language;
  const formattedCalories = new Intl.NumberFormat(locale).format(totalCalories);
  const showSave = Boolean(user) && totalCalories > 0;
  const showUnsaved = Boolean(user) && isDirty && totalCalories > 0;

  useEffect(() => {
    if (!user || typeof window === "undefined") {
      setIsDirty(false);
      return;
    }
    const readDirty = () => {
      try {
        setIsDirty(window.localStorage.getItem(dirtyKeyFor(user.uid)) === "true");
      } catch {
        setIsDirty(false);
      }
    };
    readDirty();
    const handleUpdate = () => readDirty();
    window.addEventListener("calorie-quantities-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("calorie-quantities-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [user]);

  const handleSaveCalories = async () => {
    if (!user || isSaving || totalCalories <= 0) return;
    setIsSaving(true);
    try {
      await saveProfile({ calorieQuantities: quantities });
      try {
        window.localStorage.setItem(userCalorieKey(user.uid), JSON.stringify(quantities));
        window.localStorage.setItem(savedKeyFor(user.uid), JSON.stringify(quantities));
        window.localStorage.setItem(dirtyKeyFor(user.uid), "false");
      } catch {
        // ignore storage failures
      }
      setIsDirty(false);
    } catch {
      setIsDirty(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <footer
      className={
        embedded
          ? "bg-card border-t border-border"
          : "fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
      }
    >
      <div className={`${embedded ? "px-4" : "container mx-auto px-4"} h-20 md:h-24 lg:h-28 flex items-center justify-between gap-4`}>
        {/* Total Calories Display */}
        <div className="flex flex-col">
          <span className="text-tv-small text-muted-foreground">{t("menu.totalCalories")}</span>
          <span className="text-tv-title text-primary font-bold">
            {formattedCalories}
            <span className="text-tv-body text-muted-foreground ml-2">{t("units.kcal")}</span>
          </span>
          {showUnsaved && (
            <span className="mt-1 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5 w-fit">
              {t("menu.unsaved")}
            </span>
          )}
        </div>

        <div className="flex-1 flex justify-center">
          {showSave && (
            <Button
              variant={isDirty ? "default" : "secondary"}
              size="lg"
              onClick={handleSaveCalories}
              disabled={!isDirty || isSaving}
              className="touch-target text-tv-body font-medium px-6 md:px-8"
            >
              {t("menu.saveCalories")}
            </Button>
          )}
        </div>

        {/* Clear All Button */}
        <Button
          variant="destructive"
          size="lg"
          onClick={clearAll}
          className="touch-target text-tv-body font-medium px-6 md:px-8"
        >
          <Trash2 className="h-5 w-5 md:h-6 md:w-6 mr-2" />
          {t("menu.clearAll")}
        </Button>
      </div>
    </footer>
  );
};

export default BottomBar;
