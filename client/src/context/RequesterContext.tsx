import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { DevRequester, getDevRequesters } from "../api.js";

const STORAGE_KEY = "toktickit_requester_id";

interface RequesterContextValue {
  currentRequester: DevRequester | null;
  allRequesters: DevRequester[];
  isLoading: boolean;
  setCurrentRequester: (requester: DevRequester | null) => void;
}

const RequesterContext = createContext<RequesterContextValue | null>(null);

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [currentRequester, setCurrentRequesterState] = useState<DevRequester | null>(null);
  const [allRequesters, setAllRequesters] = useState<DevRequester[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const requesters = await getDevRequesters();
        setAllRequesters(requesters);

        // Rehydrate stored requester from localStorage if still active
        const storedId = localStorage.getItem(STORAGE_KEY);
        if (storedId) {
          const found = requesters.find((r) => r.id === storedId);
          if (found) {
            setCurrentRequesterState(found);
          } else {
            // Stored requester is no longer active — clear it
            localStorage.removeItem(STORAGE_KEY);
          }
        }

        // Auto-select first requester if none stored
        if (!storedId && requesters.length > 0) {
          setCurrentRequesterState(requesters[0]);
          localStorage.setItem(STORAGE_KEY, requesters[0].id);
        }
      } catch (err) {
        console.error("Failed to load dev requesters:", err);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  function setCurrentRequester(requester: DevRequester | null) {
    setCurrentRequesterState(requester);
    if (requester) {
      localStorage.setItem(STORAGE_KEY, requester.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <RequesterContext.Provider value={{ currentRequester, allRequesters, isLoading, setCurrentRequester }}>
      {children}
    </RequesterContext.Provider>
  );
}

export function useRequesterContext(): RequesterContextValue {
  const ctx = useContext(RequesterContext);
  if (!ctx) throw new Error("useRequesterContext must be used within RequesterProvider");
  return ctx;
}
