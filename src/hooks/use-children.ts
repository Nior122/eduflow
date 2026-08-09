"use client";

import { useEffect, useState } from "react";

export type ChildSummary = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  gender: string | null;
  className: string;
  classId: string | null;
  attendanceRate: number;
  averageScore: number;
  feeBalance: number;
  unpaidCount: number;
};

/**
 * PHASE 6 — Parent portal hook: loads the parent's children and keeps a
 * selected-child state for child-scoped pages.
 */
export function useChildren() {
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/parent/children")
      .then((r) => r.json())
      .then((d) => {
        const kids: ChildSummary[] = d?.children ?? [];
        setChildren(kids);
        if (kids.length > 0) setSelectedId(kids[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selected = children.find((c) => c.id === selectedId) ?? children[0] ?? null;

  return { children, selected, selectedId, setSelectedId, loading };
}
