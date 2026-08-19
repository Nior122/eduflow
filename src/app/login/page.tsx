"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      toast({ title: "Login failed", description: "Invalid email or password. Please try again.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    router.push(searchParams.get("callbackUrl") || "/admin/dashboard");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="name@school.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
        </div>
        <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
      </div>
      <Button type="submit" className="w-full" variant="gradient" disabled={isLoading}>
        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : "Sign In"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
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
          <p className="text-muted-foreground">Sign in to your account</p>
        </div>

        <Card className="border-border/60 shadow-xl">
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Enter your credentials to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
              <LoginForm />
            </Suspense>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Don&apos;t have an account? </span>
              <Link href="/register" className="text-primary font-medium hover:underline">Create one</Link>
            </div>

            <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">Demo Accounts:</p>
              <p>Admin: demo.admin@eduflow.demo</p>
              <p>Teacher: demo.teacher@eduflow.demo</p>
              <p>Parent: demo.parent@eduflow.demo</p>
              <p>Student: demo.student@eduflow.demo</p>
              <p className="mt-1">Password: printed by the demo seed and documented in <span className="font-mono">docs/DEMO.md</span> — not displayed here for security.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
