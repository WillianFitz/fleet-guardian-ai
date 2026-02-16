import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

  // Normaliza dados de veículos para garantir que motorista seja sempre string
  const normalizeVehicleData = useMemo(() => {
    return (item: any): any => {
      if (key === "vehicles") {
        // Garante que motorista seja sempre uma string, nunca null ou undefined
        const normalized = { ...item };
        if (normalized.motorista === null || normalized.motorista === undefined) {
          normalized.motorista = "";
        } else {
          normalized.motorista = String(normalized.motorista);
        }
        console.log(`[useStore] Normalizando veículo ${item.id}:`, { 
          antes: item.motorista, 
          depois: normalized.motorista 
        });
        return normalized;
      }
      return item;
    };
  }, [key]);

  // Fetch from API on mount (if configured)
  useEffect(() => {
    if (!apiEnabled || hasFetched.current) return;
    hasFetched.current = true;

    setLoading(true);
    api
      .list<T>(key)
      .then((data) => {
        const normalized = data.map(normalizeVehicleData);
        setItems(normalized);
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
            const normalized = normalizeVehicleData(created);
            setItems((prev) =>
              prev.map((i) => (i.id === tempId ? normalized : i))
            );
          })
          .catch((err) => {
            console.error(`[useStore] Failed to create ${key}:`, err.message);
            toast({ title: "Erro ao salvar no servidor", description: err.message, variant: "destructive" });
          });
      }

      return newItem;
    },
    [key, normalizeVehicleData]
  );

  const update = useCallback(
    (id: string, data: Partial<T>) => {
      console.log(`[useStore] Updating ${key}/${id}:`, data);
      
      // Optimistic update - garante que todos os campos sejam incluídos
      setItems((prev) => prev.map((i) => {
        if (i.id === id) {
          const updated = { ...i, ...data };
          console.log(`[useStore] Optimistic update result:`, updated);
          return updated;
        }
        return i;
      }));

      // Sync to API
      if (isApiConfigured()) {
        console.log(`[useStore] Sending update to API for ${key}/${id}:`, data);
        api.update<T>(key, id, data)
          .then((updated) => {
            console.log(`[useStore] API returned updated ${key}/${id}:`, updated);
            const normalized = normalizeVehicleData(updated);
            console.log(`[useStore] Normalized data:`, normalized);
            setItems((prev) => prev.map((i) => (i.id === id ? normalized : i)));
          })
          .catch((err) => {
            console.error(`[useStore] Failed to update ${key}/${id}:`, err.message);
          });
      }
    },
    [key, normalizeVehicleData]
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
