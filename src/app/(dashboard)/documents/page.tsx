import type { Metadata } from "next";
import { DocumentsUI } from "@/components/portal/documents-ui";

export const metadata: Metadata = { title: "School Documents" };

export default function DocumentsPage() {
  return <DocumentsUI />;
}
