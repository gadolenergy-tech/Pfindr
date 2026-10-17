"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { forgotPasswordSchema } from "@finder/shared";
import { api, ApiError } from "@/lib/api";

export default function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", parsed.data);
      // The API answers the same way whether or not the account exists, so
      // this screen never reveals who is registered.
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We could not send the reset link. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative">
      <Card className="w-full max-w-md bg-card/80 backdrop-blur border-border/50 shadow-2xl relative z-10">
        <CardHeader className="space-y-4 pt-8">
          <div className="h-12 w-12 bg-primary/20 rounded-lg flex items-center justify-center text-primary mb-2">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {submitted ? "Check your email" : "Forgot password?"}
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {submitted
              ? "If that email is registered, a password reset link is on its way. It expires in 1 hour."
              : "No worries, we'll send you reset instructions. Please enter the email associated with your account."}
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
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-background border-border/50"
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full h-11">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Open the link from your inbox to choose a new password. In local
                development the link is printed to the API server log.
              </p>
              <Button
                variant="outline"
                className="w-full h-11"
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                }}
              >
                Use a different email
              </Button>
            </div>
          )}

          <div className="text-center pt-2">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to log in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
