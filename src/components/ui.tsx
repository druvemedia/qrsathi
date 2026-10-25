"use client";
/**
 * QRSathi design-system primitives. Every page builds on these so spacing,
 * sizes, colours and focus states stay consistent.
 */
import Link from "next/link";
import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- Button ----------
type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "gradient";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-sm hover:bg-brand/90",
  // Kept for compatibility: renders as the solid primary style (no decorative gradients).
  gradient: "bg-brand text-white shadow-sm hover:bg-brand/90",
  secondary: "bg-slate-900 text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200",
  outline: "border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
  ghost: "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-500",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-sm gap-2 rounded-lg",
  icon: "h-9 w-9 rounded-lg",
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
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
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
    <Link href={href} className={cn("inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors", variants[variant], sizes[size], className)} {...props}>
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
          {required && <span className="ml-0.5 text-rose-500" aria-hidden>*</span>}
          {required && <span className="sr-only"> (required)</span>}
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
    return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn("input min-h-[84px] resize-y", invalid && "input-error", className)} {...props} />;
  },
);

export function Select({ className, invalid, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={cn("input appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8", invalid && "input-error", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...props}
    >
      {children}
    </select>
  );
}

/** Search box with icon and optional clear button. */
export const SearchInput = forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & { value: string; onChange: (v: string) => void }>(
  function SearchInput({ value, onChange, className, placeholder = "Search…", ...props }, ref) {
    return (
      <div className={cn("relative", className)}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input ref={ref} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          aria-label={props["aria-label"] || placeholder} className="input pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden" {...props} />
        {value && (
          <button type="button" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label="Clear search">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  },
);

/** One row of filters above a list or table; wraps on small screens. */
export function FilterBar({ children, actions, className }: { children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}>
      <div className="flex flex-1 flex-wrap items-center gap-2 [&>*]:min-w-0">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
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
      <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-1.5 dark:border-slate-700 dark:bg-slate-950">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 cursor-pointer" aria-label={label || "Colour"} />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => !/^#[0-9a-f]{6}$/i.test(e.target.value) && onChange("#000000")}
          className="w-full bg-transparent font-mono text-xs uppercase text-slate-700 outline-none dark:text-slate-200"
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
    <div role="radiogroup" className={cn("inline-flex flex-wrap gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800/80", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-colors",
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

/** Card with a titled header row and optional actions. */
export function Section({ title, description, actions, children, className, bodyClassName, id }: {
  title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string; id?: string;
}) {
  return (
    <section id={id} className={cn("card", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="section-title">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "slate", className }: { children: React.ReactNode; tone?: "slate" | "brand" | "green" | "amber" | "rose" | "blue" | "violet"; className?: string }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    brand: "bg-brand/10 text-brand ring-brand/20 dark:bg-brand/20",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
    amber: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
    rose: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20",
    blue: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20",
    violet: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20",
  };
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", tones[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-brand", className)} aria-label="Loading" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-800", className)} aria-hidden />;
}

/** Placeholder rows for tables/lists while data loads. */
export function LoadingSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0" />
          <div className="flex-1 space-y-1.5"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-1/5" /></div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children, action, compact }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-6 text-center dark:border-slate-700", compact ? "py-8" : "py-14")}>
      {icon && <div className="mb-3 rounded-xl bg-slate-100 p-2.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">{icon}</div>}
      <h3 className="text-sm font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
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
    <div className={cn("flex gap-3 rounded-lg border p-3 text-sm", tones[tone], className)} role={tone === "error" ? "alert" : undefined}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}

export interface Crumb { label: string; href?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" aria-hidden />}
            {c.href && i < items.length - 1 ? <Link href={c.href} className="hover:text-slate-900 dark:hover:text-white">{c.label}</Link> : <span aria-current={i === items.length - 1 ? "page" : undefined}>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ title, description, actions, icon, breadcrumbs }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; icon?: React.ReactNode; breadcrumbs?: Crumb[] }) {
  return (
    <div className="mb-6">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon && <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-card dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:grid [&>svg]:h-5 [&>svg]:w-5">{icon}</div>}
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            {description && <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2 sm:shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export function StatCard({ label, value, hint, icon, href, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; href?: string; tone?: "warn" }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {icon && <div className={cn("text-slate-400 [&>svg]:h-4 [&>svg]:w-4", tone === "warn" && "text-amber-500")}>{icon}</div>}
      </div>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums tracking-tight", tone === "warn" && "text-amber-600 dark:text-amber-400")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </>
  );
  return href
    ? <Link href={href} className="card block p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700">{body}</Link>
    : <Card className="p-4">{body}</Card>;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">{children}</kbd>;
}

/** CSS-only tooltip; content is also exposed to assistive tech via aria-label on the trigger. */
export function Tooltip({ label, children, side = "right", disabled }: { label: string; children: React.ReactNode; side?: "right" | "top" | "bottom"; disabled?: boolean }) {
  if (disabled) return <>{children}</>;
  const pos = { right: "left-full top-1/2 ml-2 -translate-y-1/2", top: "bottom-full left-1/2 mb-2 -translate-x-1/2", bottom: "top-full left-1/2 mt-2 -translate-x-1/2" }[side];
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span role="tooltip" className={cn("pointer-events-none absolute z-[70] whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-pop transition-opacity group-hover/tt:opacity-100 group-focus-within/tt:opacity-100 dark:bg-slate-700", pos)}>
        {label}
      </span>
    </span>
  );
}

/** Expandable section (e.g. "Advanced settings", "More types"). */
export function Disclosure({ title, children, defaultOpen = false, className, description }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; className?: string; description?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={cn("rounded-lg border border-slate-200 dark:border-slate-800", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium">
        <span>{title}{description && <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{description}</span>}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && <div id={id} className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">{children}</div>}
    </div>
  );
}

/** Horizontal step indicator for guided workflows. */
export function Stepper({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-x-2 gap-y-2 text-xs", className)} aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current, active = i === current;
        return (
          <li key={s} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold",
              done ? "bg-brand text-white" : active ? "bg-brand/10 text-brand ring-1 ring-brand" : "bg-slate-100 text-slate-500 dark:bg-slate-800")}>
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={cn("font-medium", active ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400")}>{s}</span>
            {i < steps.length - 1 && <span className="mx-1 hidden h-px w-6 bg-slate-200 dark:bg-slate-700 sm:block" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, footer, size = "md", description }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; size?: "sm" | "md" | "lg"; description?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        // Keep focus inside the dialog.
        const f = [...ref.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex='-1'])")];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
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
  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl" };
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} className={cn("relative flex max-h-[92vh] w-full animate-scale-in flex-col rounded-t-2xl border border-slate-200 bg-white shadow-pop dark:border-slate-800 dark:bg-slate-900 sm:rounded-2xl", widths[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 id={titleId} className="text-base font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
          <button data-close onClick={onClose} className="-mr-1 rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Confirmation dialog for destructive or consequential actions. */
export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel = "Confirm", tone = "danger", loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void | Promise<void>; title: string; children?: React.ReactNode; confirmLabel?: string; tone?: "danger" | "primary"; loading?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant={tone === "danger" ? "danger" : "primary"} onClick={run} loading={busy || loading}>{confirmLabel}</Button></>}>
      <div className="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
        {tone === "danger" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden />}
        <div className="min-w-0">{children}</div>
      </div>
    </Modal>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: React.ReactNode; icon?: React.ReactNode }[]; className?: string }) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200 dark:border-slate-800 scrollbar-thin", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
            value === t.value ? "border-brand text-slate-900 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
