"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Loader2, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return toast({ title: "This reset link is invalid or expired", variant: "destructive" });
    if (password.length < 8) return toast({ title: "Password must be at least 8 characters", variant: "destructive" });
    if (password !== confirm) return toast({ title: "Passwords don't match", variant: "destructive" });
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      setDone(true);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to reset password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <CardTitle>Password reset</CardTitle>
          <CardDescription>Your password has been changed. You can now sign in with the new one.</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/login">
            <Button variant="gradient"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Login</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-border/60 shadow-xl">
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>Enter a new password for your EduFlow account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input id="password" type="password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm Password</Label>
            <Input id="confirm" type="password" placeholder="Repeat the new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required disabled={loading} />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !password || !confirm}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...</> : <><KeyRound className="mr-2 h-4 w-4" /> Reset Password</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-md">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">EduFlow</span>
          </Link>
        </div>
        <Suspense fallback={<div className="h-64" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
