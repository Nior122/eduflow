"use client";

import { useEffect, useState } from "react";
import {
  UserRound,
  KeyRound,
  Settings,
  Loader2,
  Upload,
  ShieldCheck,
  Languages,
  Palette,
  BellRing,
  Mail,
  MessageSquare,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInitials } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type ProfileData = {
  user: { id: string; name: string | null; email: string; phone: string | null; image: string | null; role: string };
  linked: Record<string, unknown> | null;
  preferences: {
    language: string;
    theme: string;
    emailNotifications: boolean;
    smsNotifications: boolean;
    pushNotifications: boolean;
    inAppNotifications: boolean;
    twoFactorEnabled: boolean;
  };
};

const ROLE_LABELS: Record<string, string> = {
  TEACHER: "Teacher",
  PARENT: "Parent",
  STUDENT: "Student",
  SCHOOL_ADMIN: "School Admin",
  SUPER_ADMIN: "Super Admin",
  FINANCE_OFFICER: "Finance Officer",
};

export function ProfileUI() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // profile tab
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // password tab
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // preferences tab
  const [language, setLanguage] = useState("en");
  const [theme, setTheme] = useState("SYSTEM");
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [inAppNotif, setInAppNotif] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.user) return;
        setData(d);
        setName(d.user.name ?? "");
        setPhone(d.user.phone ?? "");
        setLanguage(d.preferences?.language ?? "en");
        setTheme(d.preferences?.theme ?? "SYSTEM");
        setEmailNotif(d.preferences?.emailNotifications ?? true);
        setSmsNotif(d.preferences?.smsNotifications ?? true);
        setPushNotif(d.preferences?.pushNotifications ?? true);
        setInAppNotif(d.preferences?.inAppNotifications ?? true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, phone: phone.trim() || null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save");
      setData((prev) => (prev ? { ...prev, user: { ...prev.user, name: d.user.name, phone: d.user.phone } } : prev));
      toast({ title: "Profile updated", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "avatars");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Upload failed");
      const patch = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: d.upload.url }),
      });
      if (!patch.ok) throw new Error("Failed to update avatar");
      setData((prev) => (prev ? { ...prev, user: { ...prev.user, image: d.upload.url } } : prev));
      toast({ title: "Avatar updated", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const savePassword = async () => {
    if (newPassword !== confirmPassword) {
      return toast({ title: "Passwords do not match", variant: "destructive" });
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to change password");
      toast({ title: "Password changed", variant: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to change password", variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const savePreferences = async () => {
    setSavingPrefs(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          theme,
          emailNotifications: emailNotif,
          smsNotifications: smsNotif,
          pushNotifications: pushNotif,
          inAppNotifications: inAppNotif,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to save preferences");
      toast({ title: "Preferences saved", variant: "success" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to save", variant: "destructive" });
    } finally {
      setSavingPrefs(false);
    }
  };

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  }
  if (!data) {
    return <p className="text-muted-foreground">Could not load profile.</p>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <UserRound className="h-6 w-6 text-primary" /> My Profile & Settings
      </h2>

      {/* Identity card */}
      <Card>
        <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={data.user.image ?? ""} />
              <AvatarFallback className="text-xl bg-primary/10 text-primary">{getInitials(data.user.name)}</AvatarFallback>
            </Avatar>
            <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
              {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xl font-bold">{data.user.name}</p>
              <Badge variant="secondary">{ROLE_LABELS[data.user.role] ?? data.user.role}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{data.user.email}</p>
            {data.linked?.type === "PARENT" && (
              <p className="text-sm text-muted-foreground mt-1">
                {(data.linked.children as { name: string }[] | undefined)?.length ?? 0} linked child(ren)
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground">
              {data.preferences.twoFactorEnabled ? "2FA enabled" : "2FA ready (architecture in place)"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><UserRound className="mr-1 h-4 w-4" /> Profile</TabsTrigger>
          <TabsTrigger value="password"><KeyRound className="mr-1 h-4 w-4" /> Password</TabsTrigger>
          <TabsTrigger value="preferences"><Settings className="mr-1 h-4 w-4" /> Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Account details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234…" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={data.user.email} disabled />
                <p className="text-xs text-muted-foreground">Email is your login and cannot be changed here.</p>
              </div>
              <div className="flex justify-end">
                <Button variant="gradient" onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Change password</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <Label>Current password</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>New password (min 8 characters)</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm new password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <div className="flex justify-end">
                <Button variant="gradient" onClick={savePassword} disabled={savingPassword || !currentPassword || !newPassword}>
                  {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Update password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Notification & display preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1"><Languages className="h-3.5 w-3.5" /> Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1"><Palette className="h-3.5 w-3.5" /> Theme</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SYSTEM">System</SelectItem>
                      <SelectItem value="LIGHT">Light</SelectItem>
                      <SelectItem value="DARK">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border divide-y">
                {[
                  { key: "email", label: "Email notifications", desc: "Receive school updates by email", icon: Mail, value: emailNotif, set: setEmailNotif },
                  { key: "sms", label: "SMS notifications", desc: "Receive urgent updates by SMS", icon: Smartphone, value: smsNotif, set: setSmsNotif },
                  { key: "push", label: "Push notifications", desc: "Browser push for important events", icon: BellRing, value: pushNotif, set: setPushNotif },
                  { key: "inapp", label: "In-app notifications", desc: "Show the notification bell & center", icon: MessageSquare, value: inAppNotif, set: setInAppNotif },
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.key} className="flex items-center gap-4 px-4 py-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{row.label}</p>
                        <p className="text-xs text-muted-foreground">{row.desc}</p>
                      </div>
                      <Select value={row.value ? "on" : "off"} onValueChange={(v) => row.set(v === "on")}>
                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="on">On</SelectItem>
                          <SelectItem value="off">Off</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <Button variant="gradient" onClick={savePreferences} disabled={savingPrefs}>
                  {savingPrefs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
