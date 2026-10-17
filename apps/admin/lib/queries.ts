import { api } from "./api";

/**
 * Every list endpoint answers with { ok, data, meta }, and lib/api unwraps the
 * envelope down to `data`. The paging meta is fetched separately where a page
 * needs it; for the console's modest volumes the first page is usually enough.
 */

export type AdminStats = {
  totalUsers: number;
  totalVendors: number;
  pendingVendors: number;
  verifiedVendors: number;
  inventoryItems: number;
  openContact: number;
  openPartners: number;
};

export type AdminVendor = {
  id: string;
  businessName: string;
  slug: string;
  contactEmail: string;
  contactPhone: string;
  status: "PENDING" | "VERIFIED" | "SUSPENDED" | "REJECTED";
  city: string | null;
  state: string | null;
  registrationNumber: string | null;
  createdAt: string;
  verifiedAt: string | null;
  category: { name: string; slug: string } | null;
  user: { id: string; fullName: string; email: string };
  _count: { inventoryItems: number };
};

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: "USER" | "VENDOR" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type AdminContactSubmission = {
  id: string;
  fullName: string;
  email: string;
  company: string | null;
  subject: string;
  message: string;
  handledAt: string | null;
  createdAt: string;
};

export type AdminPartner = {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  website: string | null;
  partnershipType: string;
  message: string;
  status: "INQUIRY" | "IN_REVIEW" | "ACTIVE" | "DECLINED";
  reviewedAt: string | null;
  createdAt: string;
};

export type AdminAuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { fullName: string; email: string } | null;
};

export type AdminInventoryRow = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  status: string;
  vendor: { businessName: string; slug: string };
};

export const adminApi = {
  stats: () => api.get<AdminStats>("/admin/stats"),
  vendors: (params = "") => api.get<AdminVendor[]>(`/admin/vendors${params}`),
  setVendorStatus: (id: string, status: string, reason?: string) =>
    api.patch(`/admin/vendors/${id}/status`, { status, reason }),
  users: (params = "") => api.get<AdminUser[]>(`/admin/users${params}`),
  setUserStatus: (id: string, status: "ACTIVE" | "SUSPENDED") =>
    api.patch(`/admin/users/${id}/status`, { status }),
  contactSubmissions: () =>
    api.get<AdminContactSubmission[]>("/admin/contact-submissions"),
  markContactHandled: (id: string) =>
    api.patch(`/admin/contact-submissions/${id}/handled`),
  partners: () => api.get<AdminPartner[]>("/admin/partners"),
  setPartnerStatus: (id: string, status: string) =>
    api.patch(`/admin/partners/${id}/status`, { status }),
  auditLogs: () => api.get<AdminAuditLog[]>("/admin/audit-logs"),
  topInventory: () => api.get<AdminInventoryRow[]>("/admin/inventory/top"),
};

export type AdminAffiliate = {
  id: string;
  code: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  name: string;
  email: string;
  payoutEmail: string;
  clicks: number;
  referrals: number;
  converted: number;
  commissionRate: number;
  balance: number;
  totalEarned: number;
  pendingPayouts: { id: string; amount: number; method: string; requestedAt: string }[];
  createdAt: string;
};

export const affiliateAdminApi = {
  list: () => api.get<AdminAffiliate[]>("/admin/affiliates"),
  setStatus: (id: string, status: "ACTIVE" | "SUSPENDED") =>
    api.patch(`/admin/affiliates/${id}/status`, { status }),
  credit: (id: string, amount: number, note?: string) =>
    api.post(`/admin/affiliates/${id}/credit`, { amount, note }),
  settlePayout: (id: string, status: "PAID" | "FAILED", reference?: string) =>
    api.patch(`/admin/payouts/${id}`, { status, reference }),
};
