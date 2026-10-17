"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SiGoogle, SiApple } from "react-icons/si";
import { registerSchema } from "@finder/shared";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function SignUp() {
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!acceptedTerms) {
      setError("Please accept the Terms of Service to continue.");
      return;
    }

    const parsed = registerSchema.safeParse({
      fullName,
      email,
      password,
      role: "USER",
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
      await register(parsed.data);
      // The account exists and is signed in; the verification email is next.
      router.push("/verify-email");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("We could not create your account. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-background">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <Card className="w-full max-w-md bg-transparent border-none shadow-none">
          <CardHeader className="space-y-3 px-0">
            <Link href="/" className="flex items-center space-x-2 mb-6">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-xl">
                F
              </div>
              <span className="font-bold text-xl tracking-tight">Finder</span>
            </Link>
            <CardTitle className="text-3xl font-bold tracking-tight">Create an account</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Enter your details below to join the procurement network.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Social sign-up is not wired yet — disabled rather than silently inert. */}
              <Button variant="outline" disabled title="Coming soon" className="bg-card hover:bg-card/80 border-border/50">
                <SiGoogle className="mr-2 h-4 w-4" /> Google
              </Button>
              <Button variant="outline" disabled title="Coming soon" className="bg-card hover:bg-card/80 border-border/50">
                <SiApple className="mr-2 h-4 w-4" /> Apple
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" data-testid="alert-signup-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-card border-border/50"
                />
                {fieldErrors.fullName && (
                  <p className="text-sm text-destructive">{fieldErrors.fullName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-card border-border/50"
                />
                {fieldErrors.email && (
                  <p className="text-sm text-destructive">{fieldErrors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-card border-border/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p className="text-sm text-destructive">{fieldErrors.password}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    At least 8 characters, with an uppercase letter, a lowercase letter and a number.
                  </p>
                )}
              </div>

              <div className="flex items-start space-x-2 pt-2 pb-2">
                <Checkbox
                  id="terms"
                  required
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  className="mt-1"
                />
                <label
                  htmlFor="terms"
                  className="text-sm text-muted-foreground leading-relaxed"
                >
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> and{" "}
                  <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                </label>
              </div>

              <Button type="submit" disabled={submitting} className="w-full h-11 text-lg">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="px-0 justify-center flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Log in
              </Link>
            </p>
            <div className="w-full border-t border-border/50 pt-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">Are you a supplier or manufacturer?</p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/vendor/signup">Apply as Vendor</Link>
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>

      <div className="hidden lg:flex w-1/2 bg-card relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary/10 rounded-full blur-[100px]"></div>
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-secondary/10 rounded-full blur-[100px]"></div>

        <div className="relative z-10 p-16 flex flex-col justify-end h-full">
          <blockquote className="space-y-6">
            <p className="text-3xl font-medium text-white leading-tight">
              &ldquo;Finder has completely transformed our supply chain. We reduced our sourcing time by 80% and found reliable suppliers for our medical equipment instantly.&rdquo;
            </p>
            <footer className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted border border-border"></div>
              <div>
                <div className="font-semibold text-white">Sarah Jenkins</div>
                <div className="text-sm text-muted-foreground">VP of Procurement, Global Health Sys</div>
              </div>
            </footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
