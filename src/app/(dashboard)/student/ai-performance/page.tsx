import type { Metadata } from "next";
import { PerformanceAnalyzer } from "@/components/ai/performance-analyzer";

export const metadata: Metadata = { title: "My AI Performance" };

export default function StudentAiPerformancePage() {
  return <PerformanceAnalyzer title="My AI Performance" />;
}
