"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChildSelect } from "@/components/portal/child-select";
import { useChildren } from "@/hooks/use-children";
import { PerformanceAnalyzer } from "@/components/ai/performance-analyzer";

export default function ParentAiPerformancePage() {
  const { children, selectedId, setSelectedId, loading } = useChildren();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" /> AI Performance Analysis
          </h2>
          <p className="text-muted-foreground">AI-powered insight into your child's learning</p>
        </div>
        <ChildSelect children={children} selectedId={selectedId} onSelect={setSelectedId} loading={loading} />
      </div>
      {loading ? (
        <Skeleton className="h-72" />
      ) : selectedId ? (
        <PerformanceAnalyzer key={selectedId} studentId={selectedId} title="Performance Analysis" />
      ) : (
        <p className="text-muted-foreground">No child linked to your account.</p>
      )}
    </div>
  );
}
