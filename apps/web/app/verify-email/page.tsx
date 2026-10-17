"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { MailCheck, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

const RESEND_SECONDS = 59;

export default function VerifyEmail() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  async function submit(value: string) {
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await api.post("/auth/verify-email", { code: value });
      setVerified(true);
      await refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "We could not verify that code.",
      );
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await api.post("/auth/verify-email/resend");
      setNotice("A new code is on its way.");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "We could not resend the code.",
      );
    }
  }

  const formattedCooldown = `0:${String(Math.max(cooldown, 0)).padStart(2, "0")}`;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background"></div>

      <Card className="w-full max-w-md bg-card/80 backdrop-blur border-border/50 shadow-2xl relative z-10">
        <CardHeader className="space-y-4 items-center text-center pt-8">
          <div className="h-16 w-16 bg-primary/20 rounded-full flex items-center justify-center text-primary mb-2">
            {verified ? <CheckCircle2 className="h-8 w-8" /> : <MailCheck className="h-8 w-8" />}
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {verified ? "Email verified" : "Check your email"}
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {verified ? (
              "Your account is confirmed. You now have full access to the network."
            ) : (
              <>
                We sent a 6-digit verification code to{" "}
                <strong>{user?.email ?? "your email address"}</strong>. Please
                enter it below to verify your account.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pb-8 flex flex-col items-center">
          {error && (
            <Alert variant="destructive" className="w-full">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {notice && !error && (
            <Alert className="w-full">
              <MailCheck className="h-4 w-4" />
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          {verified ? (
            <Button asChild className="w-full h-11 text-lg">
              <Link href={user?.role === "VENDOR" ? "/vendor/dashboard" : "/"}>
                Continue
              </Link>
            </Button>
          ) : (
            <>
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                // Submit as soon as the sixth digit lands, so no extra tap is needed.
                onComplete={(value) => void submit(value)}
                disabled={submitting}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="w-12 h-14 text-xl border-border bg-background" />
                  <InputOTPSlot index={1} className="w-12 h-14 text-xl border-border bg-background" />
                  <InputOTPSlot index={2} className="w-12 h-14 text-xl border-border bg-background" />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} className="w-12 h-14 text-xl border-border bg-background" />
                  <InputOTPSlot index={4} className="w-12 h-14 text-xl border-border bg-background" />
                  <InputOTPSlot index={5} className="w-12 h-14 text-xl border-border bg-background" />
                </InputOTPGroup>
              </InputOTP>

              <Button
                className="w-full h-11 text-lg"
                disabled={code.length !== 6 || submitting}
                onClick={() => void submit(code)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
                  </>
                ) : (
                  "Verify Email"
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Didn&apos;t receive the code?{" "}
                <button
                  className="text-primary hover:underline font-medium disabled:opacity-60 disabled:no-underline"
                  disabled={cooldown > 0}
                  onClick={() => void resend()}
                >
                  {cooldown > 0 ? `Resend in ${formattedCooldown}` : "Resend code"}
                </button>
              </div>
            </>
          )}

          <div className="text-center">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-2">
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
