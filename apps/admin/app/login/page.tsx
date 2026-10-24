"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { loginSchema } from "@finder/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role === "ADMIN") router.replace("/");
  }, [loading, user, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }

    setSubmitting(true);
    try {
      const signedIn = await login(parsed.data);
      // The API already refuses non-admins on every /admin route; this just
      // avoids dropping someone into a console they cannot use.
      if (signedIn.role !== "ADMIN") {
        setError("That account does not have operator access.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "We could not sign you in.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md bg-card/80 backdrop-blur border-border/50 shadow-2xl">
        <CardHeader className="space-y-4 pt-8">
          <div className="h-12 w-12 bg-primary/20 rounded-lg flex items-center justify-center text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Finder Operations
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Operator access only. Sign in with your admin account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background border-border/50"
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full h-11">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
