"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { API_KEY_SCOPES, type ApiKeyScope } from "@finder/shared";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/vendor-api";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

const SCOPE_LABEL: Record<ApiKeyScope, string> = {
  SEARCH_READ: "Search",
  INVENTORY_READ: "Read inventory",
  INVENTORY_WRITE: "Sync inventory",
  ORDERS_READ: "Read orders",
  ORDERS_WRITE: "Write orders",
};

/** The public API base shown in docs and snippets — the API host, not the proxy. */
export const PUBLIC_API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5020"}/api/v1`;

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="text-slate-400 hover:text-white gap-2 border border-white/[0.06] h-8 shrink-0"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export { CopyButton };

/**
 * Create, list and revoke API keys. A new key's secret is shown exactly once;
 * after that only its prefix exists anywhere outside the hash.
 */
export function KeyManager({ compact = false }: { compact?: boolean }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiKeyScope[]>(["INVENTORY_READ", "INVENTORY_WRITE"]);
  const [fresh, setFresh] = useState<{ key: string; name: string } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api.get<ApiKeyRow[]>("/api-keys"),
  });

  const create = useMutation({
    mutationFn: () => api.post<ApiKeyRow & { key: string }>("/api-keys", { name, scopes }),
    onSuccess: (row) => {
      setFresh({ key: row.key, name: row.name });
      setCreating(false);
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err: Error) =>
      toast({ title: "Could not create key", description: err.message, variant: "destructive" }),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/api-keys/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "Key revoked", description: "Any integration using it stops working immediately." });
    },
  });

  const active = (keys ?? []).filter((k) => !k.revokedAt);
  const shown = compact ? active : keys ?? [];

  return (
    <div className="space-y-3">
      {fresh && (
        <div className="bg-green-500/[0.06] border border-green-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[12px] text-slate-300">
              <span className="font-semibold text-white">Copy &ldquo;{fresh.name}&rdquo; now.</span> This is the only time
              the full key is shown — Finder stores just a hash of it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-[#030810] border border-white/[0.07] rounded-xl px-4 py-2.5 text-[12px] font-mono text-green-300 break-all">
              {fresh.key}
            </code>
            <CopyButton value={fresh.key} />
          </div>
          <button onClick={() => setFresh(null)} className="text-[11px] text-slate-500 hover:text-slate-300">
            I&apos;ve saved it — dismiss
          </button>
        </div>
      )}

      {isLoading && <div className="h-16 bg-white/[0.02] border border-white/[0.05] rounded-2xl animate-pulse" />}

      {shown.map((k) => (
        <div key={k.id} className={`bg-[#06101f] border rounded-2xl p-4 flex items-center gap-4 ${k.revokedAt ? "border-white/[0.04] opacity-50" : "border-blue-500/[0.12]"}`}>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <KeyRound className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-slate-200 truncate">{k.name}</span>
              {k.revokedAt && <span className="text-[9px] uppercase font-bold text-red-400">Revoked</span>}
            </div>
            <div className="font-mono text-[11px] text-blue-300">{k.keyPrefix}••••••••••••••••</div>
            <div className="text-[10px] text-slate-600 mt-0.5">
              {k.scopes.map((s) => SCOPE_LABEL[s]).join(" · ")} · created {formatDate(k.createdAt)} ·{" "}
              {k.lastUsedAt ? `used ${timeAgo(k.lastUsedAt)}` : "never used"}
            </div>
          </div>
          {!k.revokedAt && (
            <Button
              size="sm"
              variant="ghost"
              disabled={revoke.isPending}
              onClick={() => {
                if (window.confirm(`Revoke "${k.name}"? Integrations using it will stop working.`)) revoke.mutate(k.id);
              }}
              className="text-red-400 hover:text-red-300 h-8"
              aria-label="Revoke key"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}

      {!isLoading && active.length === 0 && !creating && (
        <p className="text-[12px] text-slate-500">No active keys. Create one to connect your POS, ERP or storefront.</p>
      )}

      {creating ? (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold">Key name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Warehouse POS"
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold">Permissions</label>
            <div className="flex flex-wrap gap-2">
              {API_KEY_SCOPES.filter((s) => s !== "ORDERS_WRITE").map((scope) => {
                const on = scopes.includes(scope);
                return (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setScopes((prev) => (on ? prev.filter((s) => s !== scope) : [...prev, scope]))}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                      on ? "bg-blue-500/15 text-blue-300 border-blue-500/30" : "text-slate-500 border-white/[0.07] hover:text-slate-300"
                    }`}
                  >
                    {SCOPE_LABEL[scope]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setCreating(false)} className="text-slate-400">Cancel</Button>
            <Button
              onClick={() => create.mutate()}
              disabled={name.trim().length < 2 || scopes.length === 0 || create.isPending}
              className="bg-blue-600 hover:bg-blue-500"
            >
              {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create key
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={() => setCreating(true)} className="bg-blue-600 hover:bg-blue-500 gap-2">
          <Plus className="h-4 w-4" /> New API key
        </Button>
      )}
    </div>
  );
}
