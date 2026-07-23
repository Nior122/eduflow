"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  return <div className="fixed bottom-0 right-0 z-[100] flex flex-col gap-2 p-4 max-w-md">{children}</div>;
};

type ToastVariant = "default" | "destructive" | "success";

type ToastProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: ToastVariant;
  action?: React.ReactNode;
};

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg border p-4 shadow-lg transition-all animate-in slide-in-from-right-full",
          variant === "default" && "bg-background border-border",
          variant === "destructive" && "border-destructive bg-destructive text-destructive-foreground",
          variant === "success" && "border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100",
          className
        )}
        {...props}
      />
    );
  }
);
Toast.displayName = "Toast";

const ToastAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn("inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-xs font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)}
      {...props}
    />
  )
);
ToastAction.displayName = "ToastAction";

const ToastClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100",
        className
      )}
      toast-close=""
      {...props}
    >
      <X className="h-4 w-4" />
    </button>
  )
);
ToastClose.displayName = "ToastClose";

const ToastTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm font-semibold", className)} {...props} />
  )
);
ToastTitle.displayName = "ToastTitle";

const ToastDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm opacity-90", className)} {...props} />
  )
);
ToastDescription.displayName = "ToastDescription";

const ToastViewport = () => null;

export { Toast, ToastTitle, ToastDescription, ToastClose, ToastAction, ToastProvider, ToastViewport };
export type { ToastProps, ToastVariant };
