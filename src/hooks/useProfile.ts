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

const getAuthHeaders = async () => {
  if (!auth.currentUser) {
    throw new Error("Not authenticated");
  }
  const token = await auth.currentUser.getIdToken(true);
  return { Authorization: `Bearer ${token}` };
};

export const useProfile = (enabled: boolean) => {
  const queryClient = useQueryClient();

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

  return {
    profile: query.data?.profile ?? null,
    isAdmin: query.data?.isAdmin ?? false,
    isLoading: query.isLoading,
    error: query.error,
    saveProfile: mutation.mutateAsync,
  };
};
