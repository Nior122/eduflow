"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Loader2, Mail, ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await parseJsonBody(res);
      if (!res.ok) throw new Error(data.error || "Failed to send reset link");
      if (data.dev && data.resetUrl) setDevLink(data.resetUrl);
      setSent(true);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to send reset link",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4">
        <Card className="w-full max-w-md border-border/60 shadow-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>We&apos;ve sent a password reset link to {email}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Didn&apos;t receive the email? Check your spam folder or try again.
            </p>
            {devLink && (
              <div className="mb-4 rounded-lg border border-dashed p-3 text-left">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  No email provider configured (dev mode) — use this link directly:
                </p>
                <a
                  href={devLink}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline break-all"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" /> {devLink}
                </a>
              </div>
            )}
            <Link href="/login">
              <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

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
        <Card className="border-border/60 shadow-xl">
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Enter your email and we&apos;ll send you a reset link</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="name@school.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : "Send Reset Link"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <Link href="/login" className="text-sm text-primary hover:underline flex items-center justify-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Back to login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
