import type {
  CreateInventoryItemInput,
  InventorySyncInput,
  UpdateInventoryItemInput,
} from "@finder/shared";
import { api } from "./api";

export type InventoryStatus =
  | "IN_STOCK"
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "DISCONTINUED";

export type InventoryItem = {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unit: string;
  price: number;
  currency: string;
  lowStockThreshold: number;
  status: InventoryStatus;
  imageUrl: string | null;
  brand: string | null;
  description: string | null;
  notes: string | null;
  category: { id: string; name: string; slug: string } | null;
  lastSyncedAt: string | null;
  updatedAt: string;
};

export type InventorySummary = {
  totalItems: number;
  totalUnits: number;
  /** Products that have a photo, for the photo coverage line. */
  withImages: number;
  stockValue: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  discontinued: number;
  lastSync: {
    source: string;
    startedAt: string;
    updated: number;
    created: number;
    failed: number;
  } | null;
};

export type SyncResult = {
  jobId: string;
  total: number;
  updated: number;
  created: number;
  failed: number;
  /** Products that got a library photo during this import. */
  imagesMatched: number;
  errors: { sku: string; message: string }[];
};

/** What a photo upload or the match-photos click did to the vendor's products. */
export type ImageMatchResult = { matched: number; unmatched: string[] };

export type Category = { id: string; name: string; slug: string };

export const inventoryApi = {
  summary: () => api.get<InventorySummary>("/inventory/summary"),
  list: (params = "") => api.get<InventoryItem[]>(`/inventory${params}`),
  create: (input: Partial<CreateInventoryItemInput>) =>
    api.post<InventoryItem>("/inventory", input),
  update: (id: string, input: UpdateInventoryItemInput) =>
    api.patch<InventoryItem>(`/inventory/${id}`, input),
  remove: (id: string) => api.delete<void>(`/inventory/${id}`),
  sync: (input: InventorySyncInput) =>
    api.post<SyncResult>("/inventory/sync", input),
  registerImages: (images: { url: string; fileName: string }[]) =>
    api.post<ImageMatchResult>("/inventory/images", { images }),
  matchImages: () => api.post<ImageMatchResult>("/inventory/images/match"),
  categories: () => api.get<Category[]>("/categories"),
};

export const STATUS_LABEL: Record<InventoryStatus, string> = {
  IN_STOCK: "In Stock",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
  DISCONTINUED: "Discontinued",
};

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function formatMoney(amount: number, currency = "NGN"): string {
  if (currency === "NGN") return naira.format(amount);
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);
}

/** "2m ago", "3h ago", "5d ago" — compact enough for stat tiles. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type OrderStatusApi =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "FULFILLED"
  | "CANCELLED"
  | "REFUNDED";

export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatusApi;
  subtotal: number;
  total: number;
  currency: string;
  note: string | null;
  placedAt: string;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  /** CHECKOUT = the buyer paid online through Buy now. */
  source: "VENDOR" | "CHECKOUT";
  paidAt: string | null;
  paymentReference: string | null;
  fulfilment: "PICKUP" | "DELIVERY" | null;
  deliveryAddress: string | null;
  buyerPhone: string | null;
  customer: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    company: string | null;
  } | null;
  items: {
    id: string;
    inventoryItemId: string | null;
    name: string;
    sku: string | null;
    /** The brand and photo the buyer saw when they paid. */
    brand: string | null;
    imageUrl: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
};

export type OrderSummary = {
  total: number;
  pending: number;
  processing: number;
  fulfilled: number;
  cancelled: number;
  revenue: number;
  openValue: number;
};

export type NewOrder = {
  customerId?: string | null;
  customer?: { fullName: string; email?: string | null; phone?: string | null; company?: string | null } | null;
  items: { inventoryItemId: string; quantity: number; unitPrice?: number }[];
  note?: string | null;
};

export const ordersApi = {
  summary: () => api.get<OrderSummary>("/orders/summary"),
  list: (params = "") => api.get<Order[]>(`/orders${params}`),
  create: (input: NewOrder) => api.post<Order>("/orders", input),
  setStatus: (id: string, status: OrderStatusApi) =>
    api.patch<Order>(`/orders/${id}/status`, { status }),
};

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export type Customer = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
  active: boolean;
  repeat: boolean;
  createdAt: string;
};

export type CustomerDetail = Customer & { recentOrders: Order[] };

export const customersApi = {
  summary: () =>
    api.get<{ total: number; active: number; repeat: number; totalOrders: number }>(
      "/customers/summary",
    ),
  list: (params = "") => api.get<Customer[]>(`/customers${params}`),
  get: (id: string) => api.get<CustomerDetail>(`/customers/${id}`),
};

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export type ConversationSummary = {
  id: string;
  subject: string;
  side: "VENDOR" | "USER";
  counterpart: { name: string; email: string | null };
  vendor: { id: string; businessName: string; slug: string };
  unread: number;
  lastMessage: { body: string; fromMe: boolean; createdAt: string } | null;
  lastMessageAt: string;
};

export type ChatMessage = {
  id: string;
  body: string;
  fromMe: boolean;
  senderType: string;
  readAt: string | null;
  createdAt: string;
};

export type ConversationDetail = {
  id: string;
  subject: string;
  side: "VENDOR" | "USER";
  counterpart: { name: string; email: string | null };
  vendor: { id: string; businessName: string; slug: string };
  messages: ChatMessage[];
};

export const conversationsApi = {
  list: (params = "") => api.get<ConversationSummary[]>(`/conversations${params}`),
  get: (id: string) => api.get<ConversationDetail>(`/conversations/${id}`),
  send: (id: string, body: string) =>
    api.post<ChatMessage>(`/conversations/${id}/messages`, { body }),
  archive: (id: string) => api.patch(`/conversations/${id}/archive`),
  unreadCount: () => api.get<{ unread: number }>("/conversations/unread-count"),
};

const dateFormat = new Intl.DateTimeFormat("en-NG", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFormat.format(new Date(iso)) : "—";
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type Kpi = { value: number; trend: number | null };

export type Analytics = {
  period: "daily" | "weekly" | "monthly";
  series: { name: string; revenue: number; orders: number; views: number; profileViews: number }[];
  kpis: { revenue: Kpi; orders: Kpi; conversion: Kpi; views: Kpi; profileViews: Kpi };
};

export type Recommendation = { kind: string; title: string; detail: string; href: string };

export const analyticsApi = {
  overview: (period: Analytics["period"]) => api.get<Analytics>(`/analytics?period=${period}`),
  topProducts: () =>
    api.get<{ name: string; orders: number; units: number; revenue: number }[]>(
      "/analytics/top-products",
    ),
  customerGrowth: () => api.get<{ name: string; customers: number }[]>("/analytics/customer-growth"),
  recommendations: () => api.get<Recommendation[]>("/analytics/recommendations"),
};

/** "+12%", "-3%", or "New" when there is no earlier baseline to compare with. */
export function formatTrend(trend: number | null, suffix = "%"): string {
  if (trend === null) return "New";
  return `${trend > 0 ? "+" : ""}${trend}${suffix}`;
}

/** 84200 → "84.2K", 1_240_000 → "1.2M". */
export function compact(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
