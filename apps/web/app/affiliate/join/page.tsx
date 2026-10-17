"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, Share2 } from "lucide-react";
import { affiliateApplicationSchema } from "@finder/shared";
import { Navbar } from "@/components/navbar";
import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const CHANNELS = ["Website / blog", "Instagram", "X (Twitter)", "LinkedIn", "WhatsApp", "YouTube", "Email list", "In person"];

const INPUT =
  "w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40 transition-all";
const LABEL = "block text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-semibold";

function JoinForm() {
  const { user } = useAuth();
  const router = useRouter();
  const [payoutEmail, setPayoutEmail] = useState(user?.email ?? "");
  const [website, setWebsite] = useState("");
  const [audience, setAudience] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Already an affiliate? Straight to the dashboard.
  const { data: me } = useQuery({
    queryKey: ["affiliate", "me"],
    queryFn: () => api.get<{ affiliate: { code: string } | null }>("/affiliate/me"),
  });
  useEffect(() => {
    if (me?.affiliate) router.replace("/affiliate/dashboard");
  }, [me, router]);

  const join = useMutation({
    mutationFn: (body: unknown) => api.post("/affiliate/apply", body),
    onSuccess: () => router.push("/affiliate/dashboard"),
    onError: (err: Error) => {
      setError(err.message);
      if (err instanceof ApiError) setErrors(err.fieldErrors);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setError(null);
    const parsed = affiliateApplicationSchema.safeParse({
      payoutEmail,
      website: website || null,
      audienceDescription: audience,
      promotionChannels: channels,
    });
    if (!parsed.success) {
      const issues: Record<string, string> = {};
      for (const issue of parsed.error.issues) issues[issue.path.join(".")] = issue.message;
      setErrors(issues);
      return;
    }
    join.mutate(parsed.data);
  }

  const err = (k: string) => (errors[k] ? <p className="text-[11px] text-red-400 mt-1">{errors[k]}</p> : null);

  return (
    <div className="min-h-screen bg-[#040a15] text-white">
      <Navbar />
      <div className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-xl">
          <div className="flex items-center gap-2 mb-3">
            <Share2 className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Affiliate Programme</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Become a Finder affiliate</h1>
          <p className="text-slate-400 mb-8">
            Free to join, no approval wait. You get your referral link as soon as you submit.
          </p>

          <form onSubmit={submit} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 space-y-5">
            {error && (
              <div className="flex items-center gap-2 text-[12px] text-red-300 bg-red-500/[0.06] border border-red-500/20 rounded-xl px-3 py-2">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
            <div>
              <label className={LABEL}>Payout email</label>
              <input type="email" value={payoutEmail} onChange={(e) => setPayoutEmail(e.target.value)} className={INPUT} />
              {err("payoutEmail")}
            </div>
            <div>
              <label className={LABEL}>Website (optional)</label>
              <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className={INPUT} />
              {err("website")}
            </div>
            <div>
              <label className={LABEL}>Who will you refer?</label>
              <textarea rows={3} value={audience} onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. Pharmacies and clinics across Rivers State that I supply to"
                className={`${INPUT} resize-none`} />
              {err("audienceDescription")}
            </div>
            <div>
              <label className={LABEL}>Where will you promote Finder?</label>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((c) => {
                  const on = channels.includes(c);
                  return (
                    <button key={c} type="button"
                      onClick={() => setChannels((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${on ? "bg-blue-500/15 text-blue-300 border-blue-500/30" : "text-slate-500 border-white/[0.07] hover:text-slate-300"}`}>
                      {c}
                    </button>
                  );
                })}
              </div>
              {err("promotionChannels")}
            </div>
            <Button type="submit" disabled={join.isPending} className="w-full h-11 bg-blue-600 hover:bg-blue-500">
              {join.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Get my referral link
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AffiliateJoin() {
  return (
    <AuthGuard>
      <JoinForm />
    </AuthGuard>
  );
}
