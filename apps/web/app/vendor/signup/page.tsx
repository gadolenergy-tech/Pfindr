"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Store, Building, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { vendorSignupSchema } from "@finder/shared";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { VendorLocationField, type PinnedLocation } from "@/components/vendor-location-field";

type CategoryOption = { id: string; name: string; slug: string };

const EMPTY_FORM = {
  businessName: "",
  categorySlug: "",
  fullName: "",
  contactEmail: "",
  contactPhone: "",
  addressLine1: "",
  city: "",
  state: "",
  registrationNumber: "",
  password: "",
  confirmPassword: "",
};

export default function VendorSignUp() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [location, setLocation] = useState<PinnedLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const { user, loading: authLoading, registerVendor } = useAuth();
  const router = useRouter();

  // An already-registered vendor lands on their own dashboard instead of
  // restarting onboarding, which would look like their products vanished.
  useEffect(() => {
    if (!authLoading && user?.role === "VENDOR") {
      router.replace("/vendor/dashboard");
    }
  }, [authLoading, user, router]);

  // Categories come from the API so the picker cannot drift from the seed.
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<CategoryOption[]>("/categories"),
  });

  const set = (key: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function errorFor(field: string) {
    const message = fieldErrors[field];
    return message ? <p className="text-sm text-destructive">{message}</p> : null;
  }

  const LOCATION_REQUIRED = "Pin your shop location so buyers nearby can find you.";

  function continueFromContact() {
    if (!location) {
      setFieldErrors((prev) => ({ ...prev, location: LOCATION_REQUIRED }));
      return;
    }
    setStep(3);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    // Search ranks every result by distance, so a vendor with no location
    // would always sit at the bottom.
    if (!location) {
      setFieldErrors({ location: LOCATION_REQUIRED });
      setStep(2);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match" });
      return;
    }

    const parsed = vendorSignupSchema.safeParse({
      businessName: form.businessName,
      categorySlug: form.categorySlug,
      fullName: form.fullName,
      email: form.contactEmail,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      registrationNumber: form.registrationNumber || null,
      password: form.password,
      acceptedTerms: true,
      address: {
        line1: form.addressLine1,
        city: form.city,
        state: form.state,
        country: "Nigeria",
        latitude: location.latitude,
        longitude: location.longitude,
      },
    });

    if (!parsed.success) {
      const issues: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        issues[issue.path.join(".")] = issue.message;
      }
      setFieldErrors(issues);
      setError("Some details need attention — check each step.");
      return;
    }

    setSubmitting(true);
    try {
      await registerVendor(parsed.data);
      // The vendor profile starts as PENDING; the dashboard is reachable while
      // it waits on verification.
      router.push("/vendor/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("We could not submit your application. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-background">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md space-y-8">
          <div>
            <Link href="/" className="flex items-center space-x-2 mb-8">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-xl">
                F
              </div>
              <span className="font-bold text-xl tracking-tight">Finder</span>
            </Link>

            <Progress value={step * 33.3} className="h-2 mb-8" />

            <h1 className="text-3xl font-bold tracking-tight mb-2">Apply as Vendor</h1>
            <p className="text-muted-foreground">
              Join the network and expose your inventory to thousands of verified buyers.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card className="bg-card border-border/50">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit}>
                {step === 1 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 text-primary font-medium mb-4">
                      <Store className="h-5 w-5" /> Step 1: Business Profile
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessName">Business Name</Label>
                      <Input
                        id="businessName"
                        placeholder="Acme Logistics Inc."
                        className="bg-background"
                        value={form.businessName}
                        onChange={(e) => set("businessName")(e.target.value)}
                      />
                      {errorFor("businessName")}
                    </div>
                    <div className="space-y-2">
                      <Label>Primary Category</Label>
                      <Select
                        value={form.categorySlug}
                        onValueChange={set("categorySlug")}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent>
                          {(categories ?? []).map((category) => (
                            <SelectItem key={category.id} value={category.slug}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errorFor("categorySlug")}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Point of Contact Name</Label>
                      <Input
                        id="fullName"
                        placeholder="John Doe"
                        className="bg-background"
                        value={form.fullName}
                        onChange={(e) => set("fullName")(e.target.value)}
                      />
                      {errorFor("fullName")}
                    </div>
                    <Button type="button" onClick={() => setStep(2)} className="w-full mt-4 h-11">
                      Continue
                    </Button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 text-primary font-medium mb-4">
                      <Building className="h-5 w-5" /> Step 2: Contact Details
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Work Email</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        placeholder="john@acme.com"
                        className="bg-background"
                        value={form.contactEmail}
                        onChange={(e) => set("contactEmail")(e.target.value)}
                      />
                      {errorFor("email") ?? errorFor("contactEmail")}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPhone">Phone Number</Label>
                      <Input
                        id="contactPhone"
                        type="tel"
                        placeholder="+234 800 000 0000"
                        className="bg-background"
                        value={form.contactPhone}
                        onChange={(e) => set("contactPhone")(e.target.value)}
                      />
                      {errorFor("contactPhone")}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addressLine1">HQ Address</Label>
                      <Input
                        id="addressLine1"
                        placeholder="123 Supply Chain Blvd"
                        className="bg-background"
                        value={form.addressLine1}
                        onChange={(e) => set("addressLine1")(e.target.value)}
                      />
                      {errorFor("address.line1")}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          placeholder="Port Harcourt"
                          className="bg-background"
                          value={form.city}
                          onChange={(e) => set("city")(e.target.value)}
                        />
                        {errorFor("address.city")}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          placeholder="Rivers"
                          className="bg-background"
                          value={form.state}
                          onChange={(e) => set("state")(e.target.value)}
                        />
                        {errorFor("address.state")}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Shop Location</Label>
                      <VendorLocationField
                        value={location}
                        onChange={(next) => {
                          setLocation(next);
                          if (next) setFieldErrors(({ location: _cleared, ...rest }) => rest);
                        }}
                        error={fieldErrors.location}
                      />
                    </div>
                    <div className="flex gap-4 mt-4">
                      <Button type="button" onClick={() => setStep(1)} variant="outline" className="w-full h-11">
                        Back
                      </Button>
                      <Button type="button" onClick={continueFromContact} className="w-full h-11">
                        Continue
                      </Button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 text-primary font-medium mb-4">
                      <ShieldCheck className="h-5 w-5" /> Step 3: Verification
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registrationNumber">Business Registration / CAC Number</Label>
                      <Input
                        id="registrationNumber"
                        placeholder="Registration ID"
                        className="bg-background"
                        value={form.registrationNumber}
                        onChange={(e) => set("registrationNumber")(e.target.value)}
                      />
                      {errorFor("registrationNumber")}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Create Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="bg-background"
                        value={form.password}
                        onChange={(e) => set("password")(e.target.value)}
                      />
                      {errorFor("password") ?? (
                        <p className="text-xs text-muted-foreground">
                          At least 8 characters, with an uppercase letter, a lowercase letter and a number.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="bg-background"
                        value={form.confirmPassword}
                        onChange={(e) => set("confirmPassword")(e.target.value)}
                      />
                      {errorFor("confirmPassword")}
                    </div>
                    <div className="flex gap-4 mt-4">
                      <Button type="button" onClick={() => setStep(2)} variant="outline" className="w-full h-11">
                        Back
                      </Button>
                      <Button type="submit" disabled={submitting} className="w-full h-11">
                        {submitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
                          </>
                        ) : (
                          "Submit Application"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            Already a verified vendor? <Link href="/login" className="text-primary hover:underline">Log in here</Link>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex w-1/2 bg-card relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-primary/5"></div>
        <div className="max-w-lg p-12 relative z-10">
          <h2 className="text-4xl font-bold text-white mb-6">Scale your distribution overnight.</h2>
          <ul className="space-y-6">
            <li className="flex items-start gap-4">
              <div className="bg-primary/20 p-2 rounded-full mt-1">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-lg text-white">Pre-qualified Buyers</h4>
                <p className="text-muted-foreground">Never deal with tire-kickers. All buyers are verified entities with active purchase orders.</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <div className="bg-primary/20 p-2 rounded-full mt-1">
                <Building className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-lg text-white">Automated Quoting</h4>
                <p className="text-muted-foreground">Our AI generates quotes based on your rules, saving your sales team hundreds of hours.</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
