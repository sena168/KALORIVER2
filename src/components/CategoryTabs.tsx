import React from 'react';
import { cn } from '@/lib/utils';
import type { MenuCategoryWithMeta } from '@/hooks/useMenuData';
import { useTranslation } from "react-i18next";

interface CategoryTabsProps {
  categories: MenuCategoryWithMeta[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
  embedded?: boolean;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({
  categories,
  activeCategory,
  onCategoryChange,
  embedded = false,
}) => {
  const { t } = useTranslation();
  return (
    <div
      className={
        embedded
          ? "w-full bg-background border-b border-border"
          : "fixed top-16 md:top-20 lg:top-24 left-0 right-0 z-40 bg-background border-b border-border"
      }
    >
      <div className={embedded ? "px-4" : "container mx-auto px-4"}>
        <div className="flex gap-2 md:gap-4 py-3 md:py-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              className={cn(
                "flex-1 py-3 md:py-4 px-4 md:px-6 rounded-lg text-tv-body font-medium transition-all duration-200 touch-target",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
                activeCategory === category.id
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {category.id === "custom" ? t("customMenu.tabLabel") : category.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategoryTabs;
