'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export const MAX_COMPARE = 3;
export const COMPARE_STORAGE_KEY = 'compare:units';
const STORAGE_KEY = COMPARE_STORAGE_KEY;

/** Persist a compare selection to localStorage (safe no-op if unavailable). */
export function writeCompareItems(items: CompareItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_COMPARE)));
  } catch {
    /* storage unavailable */
  }
}

export interface CompareItem {
  id: string;
  label: string;
  price: string;
  coverImage: string | null;
}

interface CompareContextValue {
  items: CompareItem[];
  isSelected: (id: string) => boolean;
  toggle: (item: CompareItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** Transient message shown when the user exceeds MAX_COMPARE. */
  notice: string | null;
}

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CompareItem[];
        if (Array.isArray(parsed)) setItems(parsed.slice(0, MAX_COMPARE));
      }
    } catch {
      // Corrupt/blocked storage — start empty, never crash.
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable — in-memory only */
    }
  }, [items]);

  const flashNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  const toggle = useCallback(
    (item: CompareItem) => {
      setItems((prev) => {
        if (prev.some((i) => i.id === item.id)) {
          return prev.filter((i) => i.id !== item.id);
        }
        if (prev.length >= MAX_COMPARE) {
          flashNotice(`يمكنك مقارنة ${MAX_COMPARE} وحدات كحد أقصى. أزل وحدة لإضافة أخرى.`);
          return prev;
        }
        return [...prev, item];
      });
    },
    [flashNotice],
  );

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), []);
  const clear = useCallback(() => setItems([]), []);
  const isSelected = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  return (
    <CompareContext.Provider value={{ items, isSelected, toggle, remove, clear, notice }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompare must be used within a CompareProvider');
  return ctx;
}
