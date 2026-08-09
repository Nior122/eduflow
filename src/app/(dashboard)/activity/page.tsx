import type { Metadata } from "next";
import { ActivityUI } from "@/components/portal/activity-ui";

export const metadata: Metadata = { title: "My Activity" };

export default function ActivityPage() {
  return <ActivityUI />;
}
