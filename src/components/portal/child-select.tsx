"use client";

import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ChildSummary } from "@/hooks/use-children";

/**
 * PHASE 6 — Child switcher for parent portal pages (supports multiple
 * children under one parent account).
 */
export function ChildSelect({
  children,
  selectedId,
  onSelect,
  loading,
}: {
  children: ChildSummary[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-9 w-64" />;
  if (children.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedId || undefined} onValueChange={onSelect}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Select child…" />
        </SelectTrigger>
        <SelectContent>
          {children.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.firstName} {c.lastName} · {c.className}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {children.length > 0 && (
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {children.length} child{children.length > 1 ? "ren" : ""} linked
        </Badge>
      )}
    </div>
  );
}
