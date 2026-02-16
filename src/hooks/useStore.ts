import { useState, useEffect, useCallback, useRef } from "react";
import { api, isApiConfigured } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export interface StoreItem {
  id: string;
  [key: string]: any;
}

// Generic store hook with API sync + localStorage fallback
function useStore<T extends StoreItem>(key: string, initialData: T[] = []) {
  const apiEnabled = isApiConfigured();

  const [items, setItems] = useState<T[]>(() => {
    if (apiEnabled) {
      // When API is configured, start empty — data comes from the server
      return [];
    }
    try {
      const saved = localStorage.getItem(`fleet_${key}`);
      return saved ? JSON.parse(saved) : initialData;
    } catch {
      return initialData;
    }
  });
  const [loading, setLoading] = useState(apiEnabled);
  const hasFetched = useRef(false);

  // Sync to localStorage only when API is NOT configured (offline fallback)
  useEffect(() => {
    if (!apiEnabled) {
      localStorage.setItem(`fleet_${key}`, JSON.stringify(items));
    }
  }, [key, items, apiEnabled]);

  // Fetch from API on mount (if configured)
  useEffect(() => {
    if (!apiEnabled || hasFetched.current) return;
    hasFetched.current = true;

    setLoading(true);
    api
      .list<T>(key)
      .then((data) => {
        setItems(data);
      })
      .catch((err) => {
        console.error(`[useStore] Failed to fetch ${key}:`, err.message);
        // Fallback to initialData on error
        setItems(initialData);
      })
      .finally(() => setLoading(false));
  }, [key]);

  const add = useCallback(
    (item: Omit<T, "id">) => {
      const tempId = crypto.randomUUID();
      const newItem = { ...item, id: tempId } as T;

      // Optimistic update
      setItems((prev) => [newItem, ...prev]);

      // Sync to API
      if (isApiConfigured()) {
        console.log(`[useStore] Creating ${key}...`, item);
        api
          .create<T>(key, item)
          .then((created) => {
            console.log(`[useStore] Created ${key} successfully:`, created);
            setItems((prev) =>
              prev.map((i) => (i.id === tempId ? { ...created } : i))
            );
          })
          .catch((err) => {
            console.error(`[useStore] Failed to create ${key}:`, err.message);
            toast({ title: "Erro ao salvar no servidor", description: err.message, variant: "destructive" });
          });
      }

      return newItem;
    },
    [key]
  );

  const update = useCallback(
    (id: string, data: Partial<T>) => {
      // Optimistic update
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)));

      // Sync to API
      if (isApiConfigured()) {
        api.update<T>(key, id, data).catch((err) => {
          console.error(`[useStore] Failed to update ${key}/${id}:`, err.message);
        });
      }
    },
    [key]
  );

  const remove = useCallback(
    (id: string) => {
      // Optimistic update
      setItems((prev) => prev.filter((i) => i.id !== id));

      // Sync to API
      if (isApiConfigured()) {
        api.remove(key, id).catch((err) => {
          console.error(`[useStore] Failed to delete ${key}/${id}:`, err.message);
        });
      }
    },
    [key]
  );

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  return { items, add, update, remove, clear, setItems, loading };
}

export default useStore;
