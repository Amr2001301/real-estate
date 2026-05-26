'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { readClientUser } from '@/lib/client-user';

/**
 * Client-side favorites state for public pages. Calls the authenticated
 * favorites API via the same-origin /api-proxy rewrite — the httpOnly
 * access_token cookie is sent automatically and the edge middleware injects the
 * Bearer header, so the token is NEVER read by JS. Public HTML stays
 * user-agnostic (cacheable); favorite state hydrates here after mount.
 *
 * Removal needs the favorite RECORD id (not project/unit id), so we keep
 * id-maps populated from the list GET and the create POST responses.
 */

type Kind = 'project' | 'unit';

interface FavItem {
  id: string;
  projectId: string | null;
  unitId: string | null;
}

interface FavoritesContextValue {
  /** Authenticated CLIENT/CUSTOMER may favorite; otherwise the button is a login CTA. */
  canFavorite: boolean;
  ready: boolean;
  isFavorite: (kind: Kind, id: string) => boolean;
  isPending: (kind: Kind, id: string) => boolean;
  toggle: (kind: Kind, id: string) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [canFavorite, setCanFavorite] = useState(false);
  const [ready, setReady] = useState(false);
  const [projectMap, setProjectMap] = useState<Record<string, string>>({});
  const [unitMap, setUnitMap] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    const user = readClientUser();
    const can = !!user && (user.role === 'CLIENT' || user.role === 'CUSTOMER');
    setCanFavorite(can);
    if (!can) {
      setReady(true);
      return;
    }
    let active = true;
    fetch('/api-proxy/me/favorites', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<FavItem[]>) : Promise.reject(r.status)))
      .then((items) => {
        if (!active) return;
        const pm: Record<string, string> = {};
        const um: Record<string, string> = {};
        for (const f of items) {
          if (f.projectId) pm[f.projectId] = f.id;
          if (f.unitId) um[f.unitId] = f.id;
        }
        setProjectMap(pm);
        setUnitMap(um);
      })
      .catch(() => {
        /* favorites unavailable — cards still render in the inactive state */
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const keyOf = (kind: Kind, id: string) => `${kind}:${id}`;

  const isFavorite = useCallback(
    (kind: Kind, id: string) => Boolean((kind === 'project' ? projectMap : unitMap)[id]),
    [projectMap, unitMap],
  );

  const isPending = useCallback((kind: Kind, id: string) => pending.has(keyOf(kind, id)), [pending]);

  const toggle = useCallback(
    async (kind: Kind, id: string) => {
      if (!canFavorite) return;
      const key = keyOf(kind, id);
      if (pending.has(key)) return;

      const map = kind === 'project' ? projectMap : unitMap;
      const setMap = kind === 'project' ? setProjectMap : setUnitMap;
      const favId = map[id];

      setPending((p) => new Set(p).add(key));
      try {
        if (favId) {
          // Optimistic remove
          setMap((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          const res = await fetch(`/api-proxy/me/favorites/${favId}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('delete failed');
        } else {
          // Optimistic add (placeholder id until the real one returns)
          setMap((prev) => ({ ...prev, [id]: '__pending__' }));
          const res = await fetch('/api-proxy/me/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(kind === 'project' ? { projectId: id } : { unitId: id }),
          });
          if (!res.ok) throw new Error('add failed');
          const created = (await res.json()) as FavItem;
          setMap((prev) => ({ ...prev, [id]: created.id }));
        }
      } catch {
        // Revert to the pre-toggle state
        setMap((prev) => {
          const next = { ...prev };
          if (favId) next[id] = favId;
          else delete next[id];
          return next;
        });
      } finally {
        setPending((p) => {
          const next = new Set(p);
          next.delete(key);
          return next;
        });
      }
    },
    [canFavorite, pending, projectMap, unitMap],
  );

  return (
    <FavoritesContext.Provider value={{ canFavorite, ready, isFavorite, isPending, toggle }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider');
  return ctx;
}
