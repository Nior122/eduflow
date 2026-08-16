"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Plan = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
};

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing/plans")
      .then((r) => r.json())
      .then((d) => setPlans(d.plans ?? []))
      .catch(() => toast({ title: "Failed to load plans", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-muted/30 py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold">Simple, transparent pricing</h1>
          <p className="mt-2 text-muted-foreground">
            Every plan starts with a 14-day free trial. No credit card required.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <Card key={p.id} className={p.code === "PROFESSIONAL" ? "ring-2 ring-primary" : undefined}>
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-3xl font-bold">{(p.priceMonthly / 100).toFixed(2)}</span>
                  <span className="text-sm text-muted-foreground"> {p.currency}/month</span>
                  <p className="text-xs text-muted-foreground">or {(p.priceYearly / 100).toFixed(2)}/year</p>
                </div>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" /> School management core</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" /> AI tools included</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" /> Email support</li>
                </ul>
                <Link href="/register" className="block">
                  <Button className="w-full">Start free trial</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
