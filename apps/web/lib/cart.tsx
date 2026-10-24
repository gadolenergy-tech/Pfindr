"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

/**
 * A product in the cart, as the buyer saw it. Price and stock are a snapshot for
 * display; the server re-prices every line when the buyer pays.
 */
export type CartItem = {
  inventoryItemId: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  vendorId: string;
  vendor: string;
  vendorCity: string;
  unitPrice: number;
  currency: string;
  unit: string;
  /** Units on hand when added, or null when the vendor hides exact stock. */
  stock: number | null;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  /** Total units across the cart, for the navbar badge. */
  count: number;
  has: (inventoryItemId: string) => boolean;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (inventoryItemId: string, quantity: number) => void;
  remove: (inventoryItemId: string) => void;
  /** Drops paid lines once a purchase completes. */
  removeMany: (inventoryItemIds: string[]) => void;
};

const CartContext = createContext<CartState | null>(null);

const MAX_QTY = 1000;
const keyFor = (userId: string) => `finder:cart:${userId}`;

const clamp = (item: { stock: number | null }, quantity: number) =>
  Math.max(1, Math.min(item.stock ?? MAX_QTY, MAX_QTY, Math.floor(quantity) || 1));

/** The cart lives in this browser, one per signed-in account. Storage can be unavailable. */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<CartItem[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoadedFor(null);
      return;
    }
    try {
      const raw = localStorage.getItem(keyFor(userId));
      setItems(raw ? (JSON.parse(raw) as CartItem[]) : []);
    } catch {
      setItems([]);
    }
    setLoadedFor(userId);
  }, [userId]);

  // Only write once this account's cart has been read, or the first render
  // would overwrite it with an empty list.
  useEffect(() => {
    if (!userId || loadedFor !== userId) return;
    try {
      localStorage.setItem(keyFor(userId), JSON.stringify(items));
    } catch {
      /* private mode or full storage: the cart just won't survive a reload */
    }
  }, [items, userId, loadedFor]);

  const add = useCallback<CartState["add"]>((item, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((i) => i.inventoryItemId === item.inventoryItemId);
      if (existing) {
        return current.map((i) =>
          i.inventoryItemId === item.inventoryItemId
            ? { ...i, ...item, quantity: clamp(item, i.quantity + quantity) }
            : i,
        );
      }
      return [...current, { ...item, quantity: clamp(item, quantity) }];
    });
  }, []);

  const setQuantity = useCallback<CartState["setQuantity"]>((id, quantity) => {
    setItems((current) => current.map((i) => (i.inventoryItemId === id ? { ...i, quantity: clamp(i, quantity) } : i)));
  }, []);

  const removeMany = useCallback<CartState["removeMany"]>((ids) => {
    const gone = new Set(ids);
    setItems((current) => current.filter((i) => !gone.has(i.inventoryItemId)));
  }, []);

  const value = useMemo<CartState>(
    () => ({
      items,
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      has: (id) => items.some((i) => i.inventoryItemId === id),
      add,
      setQuantity,
      remove: (id) => removeMany([id]),
      removeMany,
    }),
    [items, add, setQuantity, removeMany],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
