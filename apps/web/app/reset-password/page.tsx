"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { resetPasswordSchema } from "@finder/shared";
import { api, ApiError } from "@/lib/api";

/** Rough strength meter driving the four bars under the password field. */
function strengthOf(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (password.length >= 12 || /[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const strength = strengthOf(password);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!token) {
      setError("This reset link is missing its token. Request a new one.");
      return;
    }

    const parsed = resetPasswordSchema.safeParse({
      token,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      const issues: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        issues[issue.path.join(".")] = issue.message;
      }
      setFieldErrors(issues);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", parsed.data);
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("We could not reset your password. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative">
      <Card className="w-full max-w-md bg-card/80 backdrop-blur border-border/50 shadow-2xl relative z-10">
        <CardHeader className="space-y-4 pt-8">
          <div className="h-12 w-12 bg-primary/20 rounded-lg flex items-center justify-center text-primary mb-2">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {submitted ? "Password reset successfully" : "Set new password"}
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {submitted
              ? "Your password has been successfully reset, and every other device has been signed out. You can now log in with your new password."
              : "Your new password must be different from previously used passwords."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background border-border/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex gap-1 mt-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 w-full rounded-full transition-colors ${
                        i < strength ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                {fieldErrors.password ? (
                  <p className="text-sm text-destructive mt-1">{fieldErrors.password}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    At least 8 characters, with an uppercase letter, a lowercase letter and a number.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-background border-border/50"
                />
                {fieldErrors.confirmPassword && (
                  <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
                )}
              </div>
              <Button type="submit" disabled={submitting} className="w-full h-11 mt-2">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting…
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          ) : (
            <Button asChild className="w-full h-11">
              <Link href="/login">Continue to Log in</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
