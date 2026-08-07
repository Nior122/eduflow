"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

/** One-time display of generated login credentials (shown right after creation). */
export function CredentialsDialog({
  open,
  onOpenChange,
  email,
  tempPassword,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  tempPassword: string;
}) {
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  const copy = async (text: string, which: "email" | "password") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      toast({ title: "Copied to clipboard", variant: "success" });
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast({ title: "Could not copy — select the text manually", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account created — save these credentials</DialogTitle>
          <DialogDescription>
            This temporary password is shown only once. Share it securely with the new user so they
            can log in and change it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Login email</p>
              <p className="truncate text-sm font-medium">{email}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Copy email" onClick={() => copy(email, "email")}>
              {copied === "email" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Temporary password</p>
              <p className="truncate font-mono text-sm font-medium">{tempPassword}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Copy password" onClick={() => copy(tempPassword, "password")}>
              {copied === "password" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
