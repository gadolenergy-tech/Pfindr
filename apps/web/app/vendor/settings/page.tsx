"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { VendorSidebar } from "@/components/vendor-sidebar";
import { Building2, Lock, Bell, Shield, Sliders, CheckCircle2, AlertCircle, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UpdateVendorPreferencesInput, VendorPreferences } from "@finder/shared";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { inventoryApi } from "@/lib/vendor-api";
import { VendorLocationField, pinFromVendor, type PinnedLocation } from "@/components/vendor-location-field";
import { ImageUploadButton } from "@/components/image-upload";

type SettingsTab = "profile" | "account" | "notifications" | "privacy" | "preferences";

type VendorMe = {
  businessName: string;
  description: string | null;
  contactEmail: string;
  contactPhone: string;
  website: string | null;
  logoUrl: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  listingPaused: boolean;
  category: { id: string; name: string; slug: string } | null;
  preferences: VendorPreferences;
};

const TABS: { id: SettingsTab; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: "profile", icon: Building2, label: "Business Profile" },
  { id: "account", icon: Lock, label: "Account Settings" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "privacy", icon: Shield, label: "Privacy" },
  { id: "preferences", icon: Sliders, label: "Preferences" },
];

const FIELD = "bg-white/[0.03] border-white/[0.07] text-slate-200 h-10";
const SELECT = "w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-slate-300 outline-none focus:border-blue-500/40 transition-all appearance-none";

function Banner({ kind, children }: { kind: "ok" | "error" | "info"; children: React.ReactNode }) {
  const style = {
    ok: "text-green-400 bg-green-500/10 border-green-500/20",
    error: "text-red-300 bg-red-500/10 border-red-500/20",
    info: "text-slate-400 bg-white/[0.02] border-white/[0.06]",
  }[kind];
  const Icon = kind === "ok" ? CheckCircle2 : kind === "error" ? AlertCircle : Info;
  return (
    <div className={`flex items-start gap-2 text-[11px] border rounded-xl px-4 py-2.5 ${style}`}>
      <Icon className="h-3.5 w-3.5 shrink-0 mt-px" /> <span>{children}</span>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, sub, checked, onChange, disabled, badge }: {
  label: string;
  sub: string;
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <div className={`flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl ${disabled ? "opacity-50" : ""}`}>
      <div>
        <div className="text-[12px] font-semibold text-slate-200 flex items-center gap-2">
          {label}
          {badge && <span className="text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-white/[0.06] text-slate-500">{badge}</span>}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>
      </div>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative rounded-full transition-all duration-200 shrink-0 ${checked ? "bg-blue-600" : "bg-white/[0.1]"}`}
        style={{ width: "40px", height: "22px" }}>
        <div className="absolute rounded-full bg-white transition-all duration-200 shadow"
          style={{ width: "18px", height: "18px", top: "2px", left: checked ? "20px" : "2px" }} />
      </button>
    </div>
  );
}

export default function VendorSettings() {
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const router = useRouter();

  const { data: vendor } = useQuery({ queryKey: ["vendor", "me"], queryFn: () => api.get<VendorMe>("/vendors/me") });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: inventoryApi.categories });

  // Local drafts, seeded from the server once it answers.
  const [profile, setProfile] = useState({ businessName: "", description: "", categorySlug: "", addressLine1: "", city: "", state: "", contactPhone: "", contactEmail: "", website: "" });
  const [location, setLocation] = useState<PinnedLocation | null>(null);
  const [prefs, setPrefs] = useState<VendorPreferences | null>(null);
  const [passwords, setPasswords] = useState({ currentPassword: "", password: "", confirmPassword: "" });

  useEffect(() => {
    if (!vendor) return;
    setProfile({
      businessName: vendor.businessName,
      description: vendor.description ?? "",
      categorySlug: vendor.category?.slug ?? "",
      addressLine1: vendor.addressLine1 ?? "",
      city: vendor.city ?? "",
      state: vendor.state ?? "",
      contactPhone: vendor.contactPhone,
      contactEmail: vendor.contactEmail,
      website: vendor.website ?? "",
    });
    setLocation(pinFromVendor(vendor));
    setPrefs(vendor.preferences);
  }, [vendor]);

  function flash(kind: "ok" | "error", text: string) {
    setMessage({ kind, text });
    if (kind === "ok") setTimeout(() => setMessage(null), 3000);
  }
  const onError = (err: Error) => flash("error", err instanceof ApiError && Object.keys(err.fieldErrors).length
    ? Object.values(err.fieldErrors).join(" · ")
    : err.message);

  // The logo saves on its own the moment it uploads, independent of the form.
  const saveLogo = useMutation({
    mutationFn: (logoUrl: string | null) => api.patch("/vendors/me", { logoUrl }),
    onSuccess: (_data, logoUrl) => {
      void queryClient.invalidateQueries({ queryKey: ["vendor"] });
      flash("ok", logoUrl ? "Logo updated" : "Logo removed");
    },
    onError,
  });

  const saveProfile = useMutation({
    mutationFn: () => api.patch("/vendors/me", {
      businessName: profile.businessName,
      description: profile.description || null,
      categorySlug: profile.categorySlug || undefined,
      contactEmail: profile.contactEmail,
      contactPhone: profile.contactPhone,
      website: profile.website || "",
      address: {
        line1: profile.addressLine1,
        city: profile.city,
        state: profile.state,
        country: vendor?.country ?? "Nigeria",
        // Sent every time: null clears a pin the vendor removed on purpose.
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
      },
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vendor"] });
      flash("ok", "Business profile saved");
    },
    onError,
  });

  const savePrefs = useMutation({
    mutationFn: (patch: UpdateVendorPreferencesInput) => api.patch<VendorPreferences>("/vendors/me/preferences", patch),
    onSuccess: (saved) => {
      setPrefs(saved);
      void queryClient.invalidateQueries({ queryKey: ["vendor"] });
      flash("ok", "Settings saved");
    },
    onError,
  });

  const setVisibility = useMutation({
    mutationFn: (visible: boolean) => api.patch("/vendors/me/listing", { paused: !visible }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["vendor"] }),
    onError,
  });

  // Changing the password signs out every session, this one included.
  const changePassword = useMutation({
    mutationFn: () => api.post("/auth/change-password", passwords),
    onSuccess: () => router.push("/login?next=/vendor/settings"),
    onError,
  });

  const setPref = <K extends keyof VendorPreferences>(group: K, key: keyof VendorPreferences[K], value: unknown) =>
    setPrefs((prev) => (prev ? { ...prev, [group]: { ...prev[group], [key]: value } } : prev));

  const loading = !vendor || !prefs;

  return (
    <div className="min-h-screen flex bg-[#040a15]">
      <VendorSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-[#040a15]/95 backdrop-blur border-b border-white/[0.05] px-8 py-4">
          <h1 className="text-lg font-bold text-white">Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage your business profile, account, and preferences</p>
        </div>

        <div className="px-8 py-7 max-w-4xl">
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Sidebar Nav */}
            <div className="space-y-1">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => { setTab(t.id); setMessage(null); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[12px] font-medium transition-all text-left ${tab === t.id ? "bg-blue-500/10 border border-blue-500/20 text-blue-400" : "text-slate-500 hover:text-white hover:bg-white/[0.04]"}`}>
                  <t.icon className="h-3.5 w-3.5 shrink-0" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="lg:col-span-3 space-y-5">
              {message && <Banner kind={message.kind}>{message.text}</Banner>}

              {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-600" /></div>
              ) : (
                <>
                  {tab === "profile" && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-5">
                      <h2 className="text-sm font-semibold text-white">Business Profile</h2>
                      <div className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl">
                        <div className="w-14 h-14 rounded-xl bg-slate-800 border border-white/[0.08] flex items-center justify-center text-xl font-bold text-slate-400 overflow-hidden">
                          {vendor?.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- bucket host is configured per environment
                            <img src={vendor.logoUrl} alt={`${profile.businessName} logo`} className="w-full h-full object-cover" />
                          ) : (
                            profile.businessName.charAt(0).toUpperCase() || "F"
                          )}
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-slate-300">Business Logo</p>
                          <p className="text-[10px] text-slate-600 mb-2">JPG, PNG or WebP, up to 5 MB</p>
                          <div className="flex items-center gap-2">
                            <ImageUploadButton
                              purpose="logo"
                              onUploaded={async (url) => { await saveLogo.mutateAsync(url); }}
                              onError={(text) => flash("error", text)}
                              className="text-[10px] text-slate-300 border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1 rounded-lg transition-colors disabled:opacity-60"
                            >
                              {vendor?.logoUrl ? "Change logo" : "Upload logo"}
                            </ImageUploadButton>
                            {vendor?.logoUrl && (
                              <button type="button" onClick={() => saveLogo.mutate(null)} disabled={saveLogo.isPending}
                                className="text-[10px] text-slate-500 hover:text-red-400 px-2 py-1 transition-colors">
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <FieldGroup label="Business Name">
                        <Input value={profile.businessName} onChange={(e) => setProfile({ ...profile, businessName: e.target.value })} className={FIELD} />
                      </FieldGroup>
                      <FieldGroup label="Business Description">
                        <textarea value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                          rows={3} maxLength={2000} placeholder="What you supply, who you serve…"
                          className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/40 transition-all resize-none" />
                      </FieldGroup>
                      <FieldGroup label="Business Category">
                        <select value={profile.categorySlug} onChange={(e) => setProfile({ ...profile, categorySlug: e.target.value })} className={SELECT}>
                          <option value="">Select a category</option>
                          {(categories ?? []).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                        </select>
                      </FieldGroup>
                      <FieldGroup label="Business Address">
                        <Input value={profile.addressLine1} onChange={(e) => setProfile({ ...profile, addressLine1: e.target.value })} className={FIELD} />
                      </FieldGroup>
                      <div className="grid grid-cols-2 gap-3">
                        <FieldGroup label="City">
                          <Input value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} className={FIELD} />
                        </FieldGroup>
                        <FieldGroup label="State">
                          <Input value={profile.state} onChange={(e) => setProfile({ ...profile, state: e.target.value })} className={FIELD} />
                        </FieldGroup>
                      </div>
                      <FieldGroup label="Shop Location">
                        {!location && (
                          <div className="mb-3">
                            <Banner kind="error">
                              Your shop is not pinned, so your products show last in every buyer&apos;s search. Pin it below and save.
                            </Banner>
                          </div>
                        )}
                        <VendorLocationField value={location} onChange={setLocation} />
                      </FieldGroup>
                      <div className="grid grid-cols-2 gap-3">
                        <FieldGroup label="Phone Number">
                          <Input value={profile.contactPhone} onChange={(e) => setProfile({ ...profile, contactPhone: e.target.value })} className={FIELD} />
                        </FieldGroup>
                        <FieldGroup label="Website (Optional)">
                          <Input value={profile.website} onChange={(e) => setProfile({ ...profile, website: e.target.value })} placeholder="https://yoursite.com" className={FIELD} />
                        </FieldGroup>
                      </div>
                      <FieldGroup label="Public Contact Email">
                        <Input type="email" value={profile.contactEmail} onChange={(e) => setProfile({ ...profile, contactEmail: e.target.value })} className={FIELD} />
                      </FieldGroup>
                      <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending} className="bg-blue-600 hover:bg-blue-500 text-white w-full">
                        {saveProfile.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Save Business Profile
                      </Button>
                    </div>
                  )}

                  {tab === "account" && (
                    <div className="space-y-4">
                      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4">
                        <h2 className="text-sm font-semibold text-white">Sign-in Email</h2>
                        <FieldGroup label="Current Email">
                          <Input value={user?.email ?? ""} readOnly className={`${FIELD} opacity-70`} />
                        </FieldGroup>
                        <Banner kind="info">
                          Changing your sign-in email needs re-verification, which is not self-serve yet. Contact support to change it.
                          Your public contact email is under Business Profile.
                        </Banner>
                      </div>
                      <form className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-4"
                        onSubmit={(e) => { e.preventDefault(); changePassword.mutate(); }}>
                        <h2 className="text-sm font-semibold text-white">Change Password</h2>
                        {([
                          ["currentPassword", "Current Password", "current-password"],
                          ["password", "New Password", "new-password"],
                          ["confirmPassword", "Confirm New Password", "new-password"],
                        ] as const).map(([key, label, auto]) => (
                          <FieldGroup key={key} label={label}>
                            <Input type="password" autoComplete={auto} value={passwords[key]}
                              onChange={(e) => setPasswords({ ...passwords, [key]: e.target.value })}
                              placeholder="••••••••••••" className={FIELD} />
                          </FieldGroup>
                        ))}
                        <p className="text-[10px] text-slate-500">You will be signed out everywhere and asked to log in with the new password.</p>
                        <Button type="submit" size="sm" disabled={changePassword.isPending || !passwords.currentPassword || !passwords.password}
                          className="bg-blue-600 hover:bg-blue-500 text-white">
                          {changePassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Update Password
                        </Button>
                      </form>
                      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-3">
                        <h2 className="text-sm font-semibold text-white">Security</h2>
                        <Toggle label="Two-Factor Authentication" sub="Require a verification code on login" checked={false} disabled badge="Soon" />
                        <Toggle label="Login Notifications" sub="Email alert when your account is accessed from a new device" checked={false} disabled badge="Soon" />
                      </div>
                    </div>
                  )}

                  {tab === "notifications" && prefs && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-3">
                      <h2 className="text-sm font-semibold text-white mb-4">Notification Preferences</h2>
                      <Banner kind="info">Your choices are saved now. Email delivery is not live yet — alerts show in your dashboard and inbox meanwhile.</Banner>
                      <Toggle label="New Order Alerts" sub="Notified immediately when an order is recorded" checked={prefs.notifications.newOrders} onChange={(v) => setPref("notifications", "newOrders", v)} />
                      <Toggle label="Low Stock Warnings" sub="Alert when inventory drops below threshold levels" checked={prefs.notifications.lowStock} onChange={(v) => setPref("notifications", "lowStock", v)} />
                      <Toggle label="Customer Messages" sub="Email notification for new messages from buyers" checked={prefs.notifications.messages} onChange={(v) => setPref("notifications", "messages", v)} />
                      <Toggle label="Inventory Sync Errors" sub="Alert if an import or API sync has failed rows" checked={prefs.notifications.syncErrors} onChange={(v) => setPref("notifications", "syncErrors", v)} />
                      <Toggle label="Weekly Performance Summary" sub="Weekly email digest of your store performance" checked={prefs.notifications.weeklySummary} onChange={(v) => setPref("notifications", "weeklySummary", v)} />
                      <Toggle label="Platform Updates" sub="Product announcements and new Finder features" checked={prefs.notifications.platformUpdates} onChange={(v) => setPref("notifications", "platformUpdates", v)} />
                      <Toggle label="Marketing & Promotions" sub="Tips to grow visibility on Finder Network" checked={prefs.notifications.marketing} onChange={(v) => setPref("notifications", "marketing", v)} />
                      <Button onClick={() => savePrefs.mutate({ notifications: prefs.notifications })} disabled={savePrefs.isPending} className="bg-blue-600 hover:bg-blue-500 text-white w-full mt-2">
                        Save Notification Settings
                      </Button>
                    </div>
                  )}

                  {tab === "privacy" && prefs && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-3">
                      <h2 className="text-sm font-semibold text-white mb-4">Privacy Settings</h2>
                      {/* Directory visibility is the same switch as "Pause Inventory Sharing"; it saves instantly. */}
                      <Toggle label="Show Business on Finder Directory" sub="Your business appears in buyer search results (saves instantly)"
                        checked={!vendor.listingPaused} disabled={setVisibility.isPending} onChange={(v) => setVisibility.mutate(v)} />
                      <Toggle label="Show Inventory Quantities" sub="Buyers see exact stock levels; off shows “In stock” only" checked={prefs.privacy.showQuantities} onChange={(v) => setPref("privacy", "showQuantities", v)} />
                      <Toggle label="Show Pricing" sub="Display prices in search; off asks buyers to request a quote" checked={prefs.privacy.showPricing} onChange={(v) => setPref("privacy", "showPricing", v)} />
                      <Toggle label="Allow Buyer Reviews" sub="Verified buyers can leave ratings on your profile" checked={prefs.privacy.allowReviews} onChange={(v) => setPref("privacy", "allowReviews", v)} badge="Reviews soon" />
                      <Toggle label="Share Analytics with Finder" sub="Help Finder improve search quality with anonymized data" checked={prefs.privacy.shareAnalytics} onChange={(v) => setPref("privacy", "shareAnalytics", v)} />
                      <div className="pt-4 border-t border-white/[0.05]">
                        <p className="text-[11px] text-slate-500 mb-3">Data management</p>
                        <p className="text-[11px] text-slate-600">
                          Export your inventory as CSV from the Inventory page and your orders from the Orders page.
                          To close your account, contact support.
                        </p>
                      </div>
                      <Button onClick={() => savePrefs.mutate({ privacy: prefs.privacy })} disabled={savePrefs.isPending} className="bg-blue-600 hover:bg-blue-500 text-white w-full">
                        Save Privacy Settings
                      </Button>
                    </div>
                  )}

                  {tab === "preferences" && prefs && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-5">
                      <h2 className="text-sm font-semibold text-white">Platform Preferences</h2>
                      <FieldGroup label="Default Currency for New Products">
                        <select value={prefs.defaults.currency} onChange={(e) => setPref("defaults", "currency", e.target.value)} className={SELECT}>
                          <option value="NGN">Nigerian Naira (₦)</option>
                          <option value="USD">US Dollar ($)</option>
                          <option value="EUR">Euro (€)</option>
                          <option value="GBP">British Pound (£)</option>
                        </select>
                      </FieldGroup>
                      <FieldGroup label="Default Low Stock Threshold">
                        <Input type="number" min={0} value={prefs.defaults.lowStockThreshold}
                          onChange={(e) => setPref("defaults", "lowStockThreshold", Number(e.target.value))} className={FIELD} />
                      </FieldGroup>
                      <p className="text-[10px] text-slate-500 -mt-3">Applies to products you add from now on. Existing products keep their own threshold.</p>
                      <Button onClick={() => savePrefs.mutate({ defaults: prefs.defaults })} disabled={savePrefs.isPending} className="bg-blue-600 hover:bg-blue-500 text-white w-full">
                        Save Preferences
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
