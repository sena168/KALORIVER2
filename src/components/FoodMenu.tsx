import React, { useRef, useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MenuItemWithMeta } from '@/hooks/useMenuData';
import FoodCard from './FoodCard';
import { cn } from '@/lib/utils';
import { useTranslation } from "react-i18next";

interface FoodMenuProps {
  items: MenuItemWithMeta[];
  categoryId: string;
  embedded?: boolean;
  allowCustomDelete?: boolean;
  onDeleteCustomItem?: (id: string) => void;
}

const FoodMenu: React.FC<FoodMenuProps> = ({
  items,
  categoryId,
  embedded = false,
  allowCustomDelete = false,
  onDeleteCustomItem,
}) => {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showTopButton, setShowTopButton] = useState(false);
  const [showBottomButton, setShowBottomButton] = useState(false);

  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowTopButton(scrollTop > 100);
    setShowBottomButton(scrollTop < scrollHeight - clientHeight - 100);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    checkScrollButtons();
    const handle = () => checkScrollButtons();
    container.addEventListener("scroll", handle);
    window.addEventListener("resize", handle);

    const resizeObserver = new ResizeObserver(handle);
    resizeObserver.observe(container);

    const timeoutId = window.setTimeout(handle, 300);

    return () => {
      container.removeEventListener("scroll", handle);
      window.removeEventListener("resize", handle);
      resizeObserver.disconnect();
      window.clearTimeout(timeoutId);
    };
  }, [items]);

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const scrollToBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  };

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-tv-subtitle">{t("menu.emptyTitle")}</p>
          <p className="text-tv-small mt-2">
            {t("menu.emptySubtitle")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0">
      {/* Scrollable Menu Container */}
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto scrollbar-thin px-4 py-4 pb-32"
      >
        <div className={embedded ? "w-full" : "container mx-auto"}>
          <div
            className={
              embedded
                ? "grid grid-cols-1 min-[900px]:grid-cols-2 gap-4 md:gap-5 lg:gap-6 pb-4"
                : "grid grid-cols-1 min-[900px]:grid-cols-2 gap-4 md:gap-5 lg:gap-6 pb-4"
            }
          >
            {items.map((item) => (
              <FoodCard
                key={item.id}
                item={item}
                embedded={embedded}
                canDelete={allowCustomDelete && categoryId === "custom"}
                onDelete={onDeleteCustomItem}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <Button
        variant="secondary"
        size="icon"
        onClick={scrollToTop}
        className={cn(
          "absolute top-4 right-6 z-10 touch-target rounded-full shadow-lg transition-opacity duration-200",
          showTopButton ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        title={t("actions.goUp")}
      >
        <ChevronUp className="h-6 w-6" />
      </Button>

      <Button
        variant="secondary"
        size="icon"
        onClick={scrollToBottom}
        className={cn(
          "absolute bottom-4 right-6 z-10 touch-target rounded-full shadow-lg transition-opacity duration-200",
          showBottomButton ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        title={t("actions.goDown")}
      >
        <ChevronDown className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default FoodMenu;
