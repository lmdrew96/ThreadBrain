"use client";

import { useState, useEffect } from "react";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

// Module-level state — shared across all hook instances without React context
const subscribers = new Set<(t: Toast[]) => void>();
let toastList: Toast[] = [];

function emit() {
  subscribers.forEach((fn) => fn([...toastList]));
}

/** Call from anywhere (components, event handlers, etc.) */
export function toast(message: string, type: Toast["type"] = "success") {
  const id = Math.random().toString(36).slice(2);
  toastList = [...toastList, { id, message, type }];
  emit();
  setTimeout(() => {
    toastList = toastList.filter((t) => t.id !== id);
    emit();
  }, 3500);
}

/** Hook — subscribes a component to the current toast list */
export function useToasts(): Toast[] {
  const [list, setList] = useState<Toast[]>([]);

  useEffect(() => {
    subscribers.add(setList);
    return () => {
      subscribers.delete(setList);
    };
  }, []);

  return list;
}
