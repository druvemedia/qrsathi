"use client";
import Link from "next/link";
import { forwardRef, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- Button ----------
type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "gradient";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-sm shadow-brand/25 hover:bg-brand/90",
  gradient: "bg-brand-gradient text-white shadow-lg shadow-brand/25 hover:opacity-95 hover:shadow-brand/35",
  secondary: "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200",
  outline: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
  ghost: "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-xl",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-semibold transition-all active:scale-[.98] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function LinkButton({
  href, variant = "primary", size = "md", className, children, ...props
}: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center justify-center font-semibold transition-all active:scale-[.98]", variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </Link>
  );
}

// ---------- Form fields ----------
export function Field({
  label, hint, error, children, className, htmlFor, required,
}: { label?: React.ReactNode; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string; htmlFor?: string; required?: boolean }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? <p className="err" role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn("input", invalid && "input-error", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...props }, ref) {
    return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn("input min-h-[88px] resize-y", invalid && "input-error", className)} {...props} />;
  },
);

export function Select({ className, invalid, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={cn("input appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", invalid && "input-error", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...props}
    >
      {children}
    </select>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; description?: React.ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", disabled && "opacity-60")}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-brand" : "bg-slate-300 dark:bg-slate-700")}
      >
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
      </button>
      {(label || description) && (
        <label htmlFor={id} className="cursor-pointer text-sm">
          {label && <span className="font-medium text-slate-800 dark:text-slate-200">{label}</span>}
          {description && <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>}
        </label>
      )}
    </div>
  );
}

export function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-950">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer" aria-label={label || "Colour"} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => !/^#[0-9a-f]{6}$/i.test(e.target.value) && onChange("#000000")}
          className="w-full bg-transparent text-xs font-mono uppercase text-slate-700 outline-none dark:text-slate-200"
          maxLength={7}
          aria-label={`${label || "Colour"} hex`}
        />
      </div>
    </div>
  );
}

/** Pill-style segmented control. */
export function Segmented<T extends string>({ value, onChange, options, className, size = "md" }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string; size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg font-medium transition",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === o.value ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Display ----------
export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...p}>{children}</div>;
}

export function Badge({ children, tone = "slate", className }: { children: React.ReactNode; tone?: "slate" | "brand" | "green" | "amber" | "rose" | "blue" | "violet"; className?: string }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    brand: "bg-brand/10 text-brand dark:bg-brand/20",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    blue: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", tones[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-brand", className)} aria-label="Loading" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800", className)} />;
}

export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
      {icon && <div className="mb-3 rounded-2xl bg-brand/10 p-3 text-brand">{icon}</div>}
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "info", title, children, className, icon }: { tone?: "info" | "warn" | "error" | "success"; title?: React.ReactNode; children?: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100",
    warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
    error: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  };
  return (
    <div className={cn("flex gap-3 rounded-xl border p-3.5 text-sm", tones[tone], className)} role={tone === "error" ? "alert" : undefined}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions, icon }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        {icon && <div className="hidden rounded-2xl bg-brand/10 p-2.5 text-brand sm:block">{icon}</div>}
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-[28px]">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <p className="mt-2 font-display text-3xl font-extrabold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </Card>
  );
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, footer, size = "md" }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input,select,textarea,button:not([data-close])")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl" };
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div ref={ref} className={cn("card relative max-h-[92vh] w-full animate-scale-in overflow-y-auto rounded-b-none sm:rounded-2xl", widths[size])}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/90 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button data-close onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3.5 dark:border-slate-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: React.ReactNode; icon?: React.ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800 scrollbar-thin", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition",
            value === t.value ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
