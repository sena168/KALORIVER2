import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useMenuData } from '@/hooks/useMenuData';

export interface ItemQuantity {
  [itemId: string]: number;
}

export interface UseCalorieStateReturn {
  quantities: ItemQuantity;
  totalCalories: number;
  incrementQuantity: (itemId: string) => void;
  decrementQuantity: (itemId: string) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  clearAll: () => void;
  getQuantity: (itemId: string) => number;
}

export interface UseCalorieStateOptions {
  initialQuantities?: ItemQuantity;
  hydrateKey?: string;
  onPersist?: (next: ItemQuantity) => void;
  persistDelayMs?: number;
}

export const useCalorieState = (options?: UseCalorieStateOptions): UseCalorieStateReturn => {
  const initialQuantities = options?.initialQuantities ?? {};
  const hydrateKey = options?.hydrateKey;
  const persistDelayMs = options?.persistDelayMs ?? 600;
  const onPersist = options?.onPersist;
  const [quantities, setQuantities] = useState<ItemQuantity>(initialQuantities);
  const hydrateKeyRef = useRef<string | undefined>(hydrateKey);
  const didHydrateRef = useRef(false);
  const skipPersistRef = useRef(true);
  
  const { categories: menuData } = useMenuData({ includeHidden: false });

  useEffect(() => {
    if (hydrateKeyRef.current !== hydrateKey) {
      hydrateKeyRef.current = hydrateKey;
      didHydrateRef.current = false;
    }
  }, [hydrateKey]);

  useEffect(() => {
    if (didHydrateRef.current) return;
    setQuantities(initialQuantities);
    didHydrateRef.current = true;
    skipPersistRef.current = true;
  }, [initialQuantities]);
  
  // Create a map of item IDs to their calorie values for quick lookup
  const calorieMap = useMemo(() => {
    const map: Record<string, number> = {};
    menuData.forEach(category => {
      category.items.forEach(item => {
        map[item.id] = item.calories;
      });
    });
    return map;
  }, [menuData]);

  const totalCalories = useMemo(() => {
    return Object.entries(quantities).reduce((total, [itemId, quantity]) => {
      const calories = calorieMap[itemId] || 0;
      return total + (calories * quantity);
    }, 0);
  }, [quantities, calorieMap]);

  const incrementQuantity = useCallback((itemId: string) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
  }, []);

  const decrementQuantity = useCallback((itemId: string) => {
    setQuantities(prev => {
      const currentQty = prev[itemId] || 0;
      if (currentQty <= 0) return prev;
      
      const newQty = currentQty - 1;
      if (newQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      
      return {
        ...prev,
        [itemId]: newQty,
      };
    });
  }, []);

  const setQuantity = useCallback((itemId: string, quantity: number) => {
    setQuantities(prev => {
      if (quantity <= 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [itemId]: quantity,
      };
    });
  }, []);

  const clearAll = useCallback(() => {
    setQuantities({});
  }, []);

  const getQuantity = useCallback((itemId: string) => {
    return quantities[itemId] || 0;
  }, [quantities]);

  useEffect(() => {
    if (!onPersist) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    const timeoutId = window.setTimeout(() => onPersist(quantities), persistDelayMs);
    return () => window.clearTimeout(timeoutId);
  }, [quantities, onPersist, persistDelayMs]);

  return {
    quantities,
    totalCalories,
    incrementQuantity,
    decrementQuantity,
    setQuantity,
    clearAll,
    getQuantity,
  };
};
