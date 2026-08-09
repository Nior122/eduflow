import type { Metadata } from "next";
import { NotificationsUI } from "@/components/portal/notifications-ui";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return <NotificationsUI />;
}
