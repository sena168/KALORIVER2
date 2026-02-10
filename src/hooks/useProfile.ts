import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auth } from "@/integrations/firebase/client";

export type UserProfile = {
  id: string;
  uid: string;
  email?: string | null;
  age?: number | null;
  weight?: number | null;
  height?: number | null;
  gender?: string | null;
  username?: string | null;
  photoUrl?: string | null;
  calorieQuantities?: Record<string, number> | null;
  burnList?: Array<{ key: string; met: number; minutes: number }> | null;
};

const GUEST_CALORIE_KEY = "calorie-quantities-guest";
const GUEST_BURN_KEY = "burn-list-guest";
const userCalorieKey = (uid: string) => `calorie-quantities:${uid}`;
const savedKeyFor = (uid: string) => `calorie-quantities-saved:${uid}`;
const dirtyKeyFor = (uid: string) => `calorie-quantities-dirty:${uid}`;
const userBurnKey = (uid: string) => `burn-list:${uid}`;

const readGuestCalories = (): Record<string, number> | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GUEST_CALORIE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

const readGuestBurnList = (): Array<{ key: string; met: number; minutes: number }> | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GUEST_BURN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Array<{ key: string; met: number; minutes: number }>;
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const hasCalories = (data?: Record<string, number> | null) =>
  Boolean(data && Object.values(data).some((value) => value > 0));

const getAuthHeaders = async () => {
  if (!auth.currentUser) {
    throw new Error("Not authenticated");
  }
  const token = await auth.currentUser.getIdToken(true);
  return { Authorization: `Bearer ${token}` };
};

export const useProfile = (enabled: boolean) => {
  const queryClient = useQueryClient();
  const guestTransferRef = useRef(false);

  const query = useQuery({
    queryKey: ["profile"],
    enabled,
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/profile", { headers });
      if (!res.ok) throw new Error("Failed to load profile");
      return res.json() as Promise<{ profile: UserProfile | null; isAdmin: boolean }>;
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: Partial<UserProfile>) => {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save profile");
      return res.json() as Promise<{ profile: UserProfile | null; isAdmin: boolean }>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["profile"], data);
    },
  });

  useEffect(() => {
    if (!enabled) return;
    if (guestTransferRef.current) return;
    if (typeof window === "undefined") return;
    if (!auth.currentUser) return;
    if (query.isLoading) return;

    guestTransferRef.current = true;

    const guestAccess = window.localStorage.getItem("guest-access") === "true";
    const guestCalories = readGuestCalories();
    const guestBurn = readGuestBurnList();
    const hasGuestCalories = hasCalories(guestCalories);
    const hasGuestBurn = Boolean(guestBurn && guestBurn.length > 0);

    if (!guestAccess && !hasGuestCalories && !hasGuestBurn) return;

    const profile = query.data?.profile ?? null;
    const hasProfileCalories = hasCalories(profile?.calorieQuantities);
    const hasProfileBurn = Boolean(profile?.burnList && profile.burnList.length > 0);

    const updates: Partial<UserProfile> = {};
    if (!hasProfileCalories && hasGuestCalories && guestCalories) {
      updates.calorieQuantities = guestCalories;
    }
    if (!hasProfileBurn && hasGuestBurn && guestBurn) {
      updates.burnList = guestBurn;
    }

    const finalizeCleanup = () => {
      try {
        window.localStorage.removeItem(GUEST_CALORIE_KEY);
        window.localStorage.removeItem(GUEST_BURN_KEY);
        window.localStorage.removeItem("guest-access");
        window.localStorage.removeItem("theme-mode-guest");
      } catch {
        // ignore storage failures
      }
    };

    if (Object.keys(updates).length === 0) {
      finalizeCleanup();
      return;
    }

    mutation
      .mutateAsync(updates)
      .then(() => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        if (updates.calorieQuantities) {
          const payload = JSON.stringify(updates.calorieQuantities);
          try {
            window.localStorage.setItem(userCalorieKey(uid), payload);
            window.localStorage.setItem(savedKeyFor(uid), payload);
            window.localStorage.setItem(dirtyKeyFor(uid), "false");
            window.dispatchEvent(new Event("calorie-quantities-updated"));
          } catch {
            // ignore storage failures
          }
        }
        if (updates.burnList) {
          try {
            window.localStorage.setItem(userBurnKey(uid), JSON.stringify(updates.burnList));
          } catch {
            // ignore storage failures
          }
        }
      })
      .finally(() => {
        finalizeCleanup();
      });
  }, [enabled, query.isLoading, query.data?.profile, mutation]);

  return {
    profile: query.data?.profile ?? null,
    isAdmin: query.data?.isAdmin ?? false,
    isLoading: query.isLoading,
    error: query.error,
    saveProfile: mutation.mutateAsync,
  };
};
