import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { DevRequester, getDevRequesters } from "../api.js";

const LOCAL_STORAGE_KEY = "toktickit_requester_id";

export interface RequesterContextType {
  currentRequester: DevRequester | null;
  activeRequesters: DevRequester[];
  isLoading: boolean;
  isSelectorOpen: boolean;
  setRequester: (id: string) => void;
  openSelector: () => void;
  closeSelector: () => void;
  error: string | null;
}

const RequesterContext = createContext<RequesterContextType | undefined>(undefined);

export const RequesterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeRequesters, setActiveRequesters] = useState<DevRequester[]>([]);
  const [currentRequester, setCurrentRequesterState] = useState<DevRequester | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRequesters() {
      setIsLoading(true);
      setError(null);
      try {
        const requesters = await getDevRequesters();
        setActiveRequesters(requesters);

        if (requesters.length > 0) {
          const savedId = localStorage.getItem(LOCAL_STORAGE_KEY);
          const found = requesters.find((r) => r.id === savedId);
          if (found) {
            setCurrentRequesterState(found);
          } else {
            // Fallback to first active requester
            setCurrentRequesterState(requesters[0]);
            localStorage.setItem(LOCAL_STORAGE_KEY, requesters[0].id);
          }
        } else {
          setCurrentRequesterState(null);
        }
      } catch (err: any) {
        console.error("Error loading dev requesters:", err);
        setError(err.message || "Failed to load development requesters");
      } finally {
        setIsLoading(false);
      }
    }

    loadRequesters();
  }, []);

  const setRequester = (id: string) => {
    const target = activeRequesters.find((r) => r.id === id);
    if (target) {
      setCurrentRequesterState(target);
      localStorage.setItem(LOCAL_STORAGE_KEY, id);
    }
  };

  const openSelector = () => setIsSelectorOpen(true);
  const closeSelector = () => setIsSelectorOpen(false);

  return (
    <RequesterContext.Provider
      value={{
        currentRequester,
        activeRequesters,
        isLoading,
        isSelectorOpen,
        setRequester,
        openSelector,
        closeSelector,
        error,
      }}
    >
      {children}
    </RequesterContext.Provider>
  );
};

export function useRequesterContext(): RequesterContextType {
  const context = useContext(RequesterContext);
  if (!context) {
    throw new Error("useRequesterContext must be used within a RequesterProvider");
  }
  return context;
}
