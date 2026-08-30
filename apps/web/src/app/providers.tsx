"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SplashScreen } from "@/components/SplashScreen";
import { ToastProvider } from "@/components/Toast";
import { LanguageProvider } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 10_000 } },
      }),
  );
  const [showSplash, setShowSplash] = useState(true);

  return (
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <ToastProvider>
          {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
          {children}
        </ToastProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
