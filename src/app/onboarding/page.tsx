"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, GraduationCap, Upload, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const STEPS = [
  { id: 1, title: "School Information" },
  { id: 2, title: "Curriculum" },
  { id: 3, title: "Academic Structure" },
  { id: 4, title: "Grading" },
  { id: 5, title: "Invite Teachers" },
  { id: 6, title: "Finish" },
];

type OnboardingState = {
  onboarding: { currentStep: number; steps: Record<string, { done?: boolean }>; isComplete: boolean };
  school: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    logo: string | null;
    motto: string | null;
    gradeSystem: string | null;
  };
  subscription: { status: string; trialEndsAt: string | null; plan: { name: string; code: string } } | null;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<OnboardingState | null>(null);
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [invites, setInvites] = useState([{ email: "" }]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/onboarding/state")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: OnboardingState) => {
        setState(d);
        setStep(d.onboarding.isComplete ? 7 : d.onboarding.currentStep);
      })
      .catch(() => toast({ title: "Failed to load onboarding state", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  const form: OnboardingState["school"] = state?.school ?? { id: "", name: "", address: "", phone: "", email: "", website: "", motto: "", gradeSystem: "", logo: null };

  const saveStep = async (data: Record<string, unknown>, next: number) => {
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, data }),
      });
      if (!res.ok) {
        const d = await parseJsonBody(res).catch(() => ({}));
        toast({ title: d.error ?? "Failed to save step", variant: "destructive" });
        return;
      }
      setStep(next);
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "logos");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await parseJsonBody(res);
      if (!res.ok) throw new Error(d.error ?? "Upload failed");
      await saveStep({ ...form, logo: d.upload.url }, step);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const finish = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding", { method: "POST" });
      if (!res.ok) {
        toast({ title: "Failed to complete onboarding", variant: "destructive" });
        return;
      }
      toast({ title: "School setup complete 🎉" });
      router.push("/admin/dashboard");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Set up {form.name || "your school"}</h1>
          <p className="text-sm text-muted-foreground">
            {state?.subscription
              ? `${state.subscription.plan.name} plan · trial ends ${new Date(state.subscription.trialEndsAt ?? "").toLocaleDateString()}`
              : "Complete these steps to activate your dashboard"}
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6 flex items-center justify-between">
          {STEPS.map((s) => (
            <div key={s.id} className="flex flex-1 items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                  step > s.id
                    ? "bg-primary text-primary-foreground"
                    : step === s.id
                      ? "bg-primary/20 text-primary ring-2 ring-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s.id ? <Check className="h-4 w-4" /> : s.id}
              </div>
              {s.id < 6 && <div className={`mx-1 h-1 flex-1 rounded ${step > s.id ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{STEPS.find((s) => s.id === step)?.title ?? "Done"}</CardTitle>
            <CardDescription>
              {step === 1 && "Basic details + your school logo. Everything can be changed later."}
              {step === 2 && "Choose the curriculum/grading system your school follows."}
              {step === 3 && "Set up academic sessions, terms, classes and subjects."}
              {step === 4 && "Configure your grading scale and assessment types."}
              {step === 5 && "Invite teachers — they get an email with a temporary password."}
              {step === 6 && "You're all set. Finish and open your dashboard."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="schoolName">School name</Label>
                  <Input id="schoolName" value={form.name} onChange={(e) => setState({ ...state!, school: { ...form, name: e.target.value } })} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" value={form.address ?? ""} onChange={(e) => setState({ ...state!, school: { ...form, address: e.target.value } })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={form.phone ?? ""} onChange={(e) => setState({ ...state!, school: { ...form, phone: e.target.value } })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input id="website" value={form.website ?? ""} onChange={(e) => setState({ ...state!, school: { ...form, website: e.target.value } })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="motto">Motto</Label>
                    <Input id="motto" value={form.motto ?? ""} onChange={(e) => setState({ ...state!, school: { ...form, motto: e.target.value } })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>School logo</Label>
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadLogo(f);
                      }}
                    />
                    <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {form.logo ? "Change logo" : "Upload logo"}
                    </Button>
                    {form.logo && <span className="text-xs text-muted-foreground">Logo uploaded ✓</span>}
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="space-y-2">
                <Label htmlFor="gradeSystem">Grading system / curriculum</Label>
                <Input
                  id="gradeSystem"
                  placeholder="e.g. Nigerian (WAEC/NECO), British, American, Cambridge"
                  defaultValue={form.gradeSystem ?? ""}
                  onBlur={(e) => setState({ ...state!, school: { ...form, gradeSystem: e.target.value } })}
                />
                <p className="text-xs text-muted-foreground">
                  You can fine-tune grade bands in Admin → Grade Scale after onboarding.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Configure sessions, terms, classes and subjects — or do it later from the admin area.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/admin/academic-setup" target="_blank">
                    <Button variant="outline">Academic setup (sessions & terms)</Button>
                  </Link>
                  <Link href="/admin/classes" target="_blank">
                    <Button variant="outline">Classes</Button>
                  </Link>
                  <Link href="/admin/subjects" target="_blank">
                    <Button variant="outline">Subjects</Button>
                  </Link>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Configure how grades are computed and displayed.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/admin/grade-scale" target="_blank">
                    <Button variant="outline">Grade scale</Button>
                  </Link>
                  <Link href="/admin/assessment-config" target="_blank">
                    <Button variant="outline">Assessment config</Button>
                  </Link>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-3">
                {invites.map((inv, i) => (
                  <Input
                    key={i}
                    type="email"
                    placeholder="teacher@school.edu"
                    value={inv.email}
                    onChange={(e) =>
                      setInvites(invites.map((x, j) => (j === i ? { email: e.target.value } : x)))
                    }
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInvites([...invites, { email: "" }])}
                >
                  Add another
                </Button>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/50 p-4 text-sm">
                  <p><strong>School:</strong> {form.name}</p>
                  <p><strong>Plan:</strong> {state?.subscription?.plan.name ?? "—"}</p>
                  <p><strong>Teachers invited:</strong> {invites.filter((i) => i.email).length}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Finishing opens your admin dashboard where you can add students, fees, results and more.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(Math.max(1, step - 1))}
                disabled={step <= 1 || saving}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              {step < 6 ? (
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (step === 1) {
                      void saveStep({ ...form }, 2);
                    } else if (step === 2) {
                      void saveStep({ gradeSystem: form.gradeSystem ?? "" }, 3);
                    } else if (step === 3) {
                      void saveStep({ confirmed: true }, 4);
                    } else if (step === 4) {
                      void saveStep({ confirmed: true }, 5);
                    } else if (step === 5) {
                      const emails = invites.map((i) => i.email.trim()).filter(Boolean);
                      if (emails.length === 0) {
                        toast({ title: "Add at least one email, or continue later from Teachers", variant: "destructive" });
                        return;
                      }
                      setSaving(true);
                      fetch("/api/onboarding/invite-teachers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ invites: emails.map((e) => ({ email: e })) }),
                      })
                        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
                        .then(() => setStep(6))
                        .catch(() => toast({ title: "Failed to send invites", variant: "destructive" }))
                        .finally(() => setSaving(false));
                    }
                  }}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save & continue"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={() => void finish()} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Finish setup"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
