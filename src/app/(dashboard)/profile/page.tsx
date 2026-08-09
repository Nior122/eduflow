import type { Metadata } from "next";
import { ProfileUI } from "@/components/portal/profile-ui";

export const metadata: Metadata = { title: "My Profile" };

export default function ProfilePage() {
  return <ProfileUI />;
}
