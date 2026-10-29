import React, { createContext, useContext, useMemo, useState } from "react";

interface DemoModeContextValue {
  demoOn: boolean;
  setDemoOn: (on: boolean) => void;
}

const DemoModeContext = createContext<DemoModeContextValue>({
  demoOn: false,
  setDemoOn: () => undefined,
});

/**
 * Demo Mode state lives only in memory for this browser tab session.
 * It is not stored in Supabase, not stored with real projects, and it
 * never changes auth or gateway behaviour — the Demo page itself simply
 * uses predefined local data instead of making AI/gateway calls.
 */
export const DemoModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [demoOn, setDemoOn] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem("nova-demo-mode") === "on";
    } catch {
      return false;
    }
  });

  const value = useMemo<DemoModeContextValue>(
    () => ({
      demoOn,
      setDemoOn: (on: boolean) => {
        setDemoOn(on);
        try {
          window.sessionStorage.setItem("nova-demo-mode", on ? "on" : "off");
        } catch {
          // Session storage is a nicety only; Demo Mode works without it.
        }
      },
    }),
    [demoOn]
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
};

export function useDemoMode(): DemoModeContextValue {
  return useContext(DemoModeContext);
}
