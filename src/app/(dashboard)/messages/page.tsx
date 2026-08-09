import type { Metadata } from "next";
import { MessagesUI } from "@/components/portal/messages-ui";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return <MessagesUI />;
}
