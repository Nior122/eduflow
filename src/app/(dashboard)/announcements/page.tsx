import type { Metadata } from "next";
import { AnnouncementsUI } from "@/components/portal/announcements-ui";

export const metadata: Metadata = { title: "Announcements" };

export default function AnnouncementsPage() {
  return <AnnouncementsUI />;
}
