import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from "react";
import { getPotholes, savePothole, updatePothole, clearAllPotholes, Pothole } from "@/lib/storage";

interface PotholeContextValue {
  potholes: Pothole[];
  isLoading: boolean;
  addPothole: (latitude: number, longitude: number, magnitude?: number) => Promise<Pothole>;
  removePothole: (id: string) => Promise<void>;
  editPothole: (id: string, latitude: number, longitude: number) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
  selectedPothole: Pothole | null;
  setSelectedPothole: (p: Pothole | null) => void;
}

const PotholeContext = createContext<PotholeContextValue | null>(null);

export function PotholeProvider({ children }: { children: ReactNode }) {
  const [potholes, setPotholes] = useState<Pothole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPothole, setSelectedPothole] = useState<Pothole | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const data = await getPotholes();
    setPotholes(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addPothole = useCallback(async (latitude: number, longitude: number, magnitude?: number) => {
    const newPothole = await savePothole({ latitude, longitude, magnitude });
    setPotholes((prev) => [...prev, newPothole]);
    return newPothole;
  }, []);

  const removePothole = useCallback(async (id: string) => {
    await deletePothole(id);
    setPotholes((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const editPothole = useCallback(async (id: string, latitude: number, longitude: number) => {
    await updatePothole(id, { latitude, longitude });
    setPotholes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, latitude, longitude } : p))
    );
  }, []);

  const clearAll = useCallback(async () => {
    await clearAllPotholes();
    setPotholes([]);
  }, []);

  const value = useMemo(
    () => ({
      potholes,
      isLoading,
      addPothole,
      removePothole,
      editPothole,
      clearAll,
      refresh,
      selectedPothole,
      setSelectedPothole,
    }),
    [potholes, isLoading, addPothole, removePothole, editPothole, clearAll, refresh, selectedPothole]
  );

  return (
    <PotholeContext.Provider value={value}>
      {children}
    </PotholeContext.Provider>
  );
}

export function usePotholes() {
  const context = useContext(PotholeContext);
  if (!context) {
    throw new Error("usePotholes must be used within a PotholeProvider");
  }
  return context;
}
