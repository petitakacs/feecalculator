"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { Location } from "@/types";

interface LocationFilterContextValue {
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
  availableLocations: Location[];
}

const STORAGE_KEY = "sc_selected_location_id";

export const LocationFilterContext = createContext<LocationFilterContextValue>({
  selectedLocationId: null,
  setSelectedLocationId: () => {},
  availableLocations: [],
});

export function LocationFilterProvider({
  children,
  locations,
}: {
  children: React.ReactNode;
  locations: Location[];
}) {
  const [selectedLocationId, setSelectedLocationIdState] = useState<string | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Only restore if the stored location still exists
    if (stored && locations.some((l) => l.id === stored)) {
      setSelectedLocationIdState(stored);
    }
  }, [locations]);

  const setSelectedLocationId = (id: string | null) => {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
    setSelectedLocationIdState(id);
  };

  return (
    <LocationFilterContext.Provider
      value={{ selectedLocationId, setSelectedLocationId, availableLocations: locations }}
    >
      {children}
    </LocationFilterContext.Provider>
  );
}

export function useLocationFilter() {
  return useContext(LocationFilterContext);
}
