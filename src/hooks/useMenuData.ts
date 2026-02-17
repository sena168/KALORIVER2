import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auth } from "@/integrations/firebase/client";

export type MenuItemWithMeta = {
  id: string;
  name: string;
  calories: number;
  imagePath: string;
  category: string;
  hidden?: boolean;
};

export type MenuCategoryWithMeta = {
  id: string;
  label: string;
  items: MenuItemWithMeta[];
};

const getAuthHeaders = async () => {
  if (!auth.currentUser) {
    throw new Error("Not authenticated");
  }
  const token = await auth.currentUser.getIdToken(true);
  return { Authorization: `Bearer ${token}` };
};

const fetchMenu = async (includeHidden: boolean) => {
  let headers: Record<string, string> = {};
  if (includeHidden) {
    headers = await getAuthHeaders();
  } else if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers = { Authorization: `Bearer ${token}` };
    } catch {
      headers = {};
    }
  }

  const res = await fetch(includeHidden ? "/api/admin/menu" : "/api/menu", {
    headers,
  });
  if (!res.ok) throw new Error("Failed to load menu");
  const data = await res.json();
  return data.categories as MenuCategoryWithMeta[];
};

const createHttpError = async (res: Response, fallback: string) => {
  let message = fallback;
  try {
    const data = await res.json();
    if (data?.error) {
      message = data.error;
    }
  } catch {
    // ignore JSON parsing errors
  }
  const error = new Error(message);
  (error as { status?: number }).status = res.status;
  return error;
};

export const useMenuData = (options?: { includeHidden?: boolean; enabled?: boolean }) => {
  const includeHidden = options?.includeHidden ?? false;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["menu", includeHidden],
    queryFn: () => fetchMenu(includeHidden),
    enabled: options?.enabled ?? true,
  });

  if (query.error) {
    console.error("Menu query error:", query.error);
  }

  const invalidateMenu = () => queryClient.invalidateQueries({ queryKey: ["menu"], exact: false });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      calories: number;
      imagePath: string;
      hidden?: boolean;
      categoryId: string;
    }) => {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/menu/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw await createHttpError(res, "Failed to create item");
      const data = await res.json();
      return data.item as MenuItemWithMeta;
    },
    onSuccess: invalidateMenu,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      patch: { name?: string; calories?: number; imagePath?: string; hidden?: boolean };
    }) => {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/menu/items", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({ id: payload.id, ...payload.patch }),
      });
      if (!res.ok) throw await createHttpError(res, "Failed to update item");
      const data = await res.json();
      return data.item as MenuItemWithMeta;
    },
    onSuccess: invalidateMenu,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/menu/items", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw await createHttpError(res, "Failed to delete item");
      return true;
    },
    onSuccess: invalidateMenu,
  });

  const orderMutation = useMutation({
    mutationFn: async (payload: { categoryId: string; order: string[] }) => {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/menu/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw await createHttpError(res, "Failed to update order");
      return true;
    },
    onSuccess: invalidateMenu,
  });

  return {
    categories: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    addItem: createMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
    deleteItem: deleteMutation.mutateAsync,
    setOrder: orderMutation.mutateAsync,
  };
};
