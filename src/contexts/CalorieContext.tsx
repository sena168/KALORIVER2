import React, { createContext, useContext, ReactNode } from 'react';
import { useCalorieState, UseCalorieStateReturn, ItemQuantity } from '@/hooks/useCalorieState';

const CalorieContext = createContext<UseCalorieStateReturn | null>(null);

export const CalorieProvider: React.FC<{
  children: ReactNode;
  initialQuantities?: ItemQuantity;
  hydrateKey?: string;
  onPersist?: (next: ItemQuantity) => void;
  persistDelayMs?: number;
}> = ({ children, initialQuantities, hydrateKey, onPersist, persistDelayMs }) => {
  const calorieState = useCalorieState({
    initialQuantities,
    hydrateKey,
    onPersist,
    persistDelayMs,
  });
  
  return (
    <CalorieContext.Provider value={calorieState}>
      {children}
    </CalorieContext.Provider>
  );
};

export const useCalories = (): UseCalorieStateReturn => {
  const context = useContext(CalorieContext);
  if (!context) {
    throw new Error('useCalories must be used within a CalorieProvider');
  }
  return context;
};
