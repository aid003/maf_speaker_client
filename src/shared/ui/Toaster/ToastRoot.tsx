"use client";

import type { ReactNode } from "react";

import { ToastProvider } from "@/shared/lib/toast/toast-context";

import { Toaster } from "@/shared/ui/Toaster/Toaster";

export function ToastRoot({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <Toaster />
    </ToastProvider>
  );
}
