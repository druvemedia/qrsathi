"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BarChart3, Eye, EyeOff, IndianRupee, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import { safeNextPath } from "@/lib/safe-redirect";
import { Logo } from "@/components/brand";
import { footerLine } from "@/lib/branding";
import { useApp } from "@/components/providers";
import { ThemeToggle } from "@/components/user-menu";
import { Alert, Button, Field, Input } from "@/components/ui";

export function AuthAside() {
  const { settings } = useApp();
  const b = settings.branding;
  return (
    <aside className="relative hidden flex-col justify-between border-r border-zinc-800 bg-[#0b0b0d] p-12 text-zinc-100 lg:flex">
      <div className="[&_a]:text-white"><Logo /></div>
      <div className="max-w-md">
        <p className="font-serif text-4xl leading-[1.15] tracking-tight">Codes for the counter, the shelf and the campaign.</p>
        <ul className="mt-10 space-y-4 text-sm text-zinc-300">
          {[
            [IndianRupee, "UPI payment QR with printable standees"],
            [RefreshCw, "Dynamic QR — change the link without reprinting"],
            [BarChart3, "Scan analytics without storing IP addresses"],
            [ShieldCheck, "We never ask for UPI PINs, OTPs or bank passwords"],
          ].map(([Icon, t]: any) => (
            <li key={t} className="flex items-center gap-3"><Icon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />{t}</li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-zinc-500">{footerLine(b)}</p>
    </aside>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="mb-8 flex items-center justify-between lg:hidden"><Logo /><ThemeToggle /></div>
      <h1 className="font-serif text-3xl tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-10" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-700" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function GoogleButton({ enabled, next }: { enabled: boolean; next: string }) {
  if (!enabled) return null;
  return (
    <>
      <a href={`/api/auth/google?next=${encodeURIComponent(next)}`} className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white text-sm font-medium transition-[background-color,transform] hover:bg-zinc-50 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" /></svg>
        Continue with Google
      </a>
      <div className="my-6 flex items-center gap-3 text-xs text-slate-400"><div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />or<div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" /></div>
    </>
  );
}

const ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't configured on this server.",
  google_state: "Google sign-in expired. Please try again.",
  google_cancelled: "Google sign-in was cancelled.",
  google_unverified: "Your Google email isn't verified.",
  suspended: "This account has been suspended.",
  signups_closed: "New sign-ups are currently closed.",
};

const safeNext = (n: string | null) => safeNextPath(n);

export function LoginForm({ google }: { google: boolean }) {
  const sp = useSearchParams();
  const router = useRouter();
  const { setUser } = useApp();
  const next = safeNext(sp.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(sp.get("error") ? ERRORS[sp.get("error")!] || "Sign-in failed. Please try again." : "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api("/api/auth/login", { method: "POST", json: { email, password } });
      setUser(user);
      toast.success(`Welcome back${user.name ? `, ${user.name.split(" ")[0]}` : ""}!`);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Header title="Welcome back" subtitle={<>New here? <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-brand hover:underline">Create a free account</Link></>} />
      <GoogleButton enabled={google} next={next} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label={<span className="flex justify-between">Password <Link href="/forgot-password" className="font-normal text-brand hover:underline">Forgot?</Link></span>} htmlFor="password">
          <PasswordInput id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
      </form>
      <p className="mt-6 text-center text-xs text-slate-500">You can generate and download static QR codes without an account. <Link href="/generator" className="text-brand hover:underline">Continue as guest</Link></p>
    </>
  );
}

export function SignupForm({ google }: { google: boolean }) {
  const sp = useSearchParams();
  const router = useRouter();
  const { setUser } = useApp();
  const next = safeNext(sp.get("next"));
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pwOk = f.password.length >= 8 && /[a-z]/i.test(f.password) && /\d/.test(f.password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terms) return setError("Please accept the Terms and Privacy Policy.");
    setBusy(true);
    setError("");
    try {
      const { user } = await api("/api/auth/signup", { method: "POST", json: { ...f, acceptTerms: true } });
      setUser(user);
      toast.success("Account created — welcome!");
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Header title="Create your account" subtitle={<>Already have one? <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-brand hover:underline">Sign in</Link></>} />
      <GoogleButton enabled={google} next={next} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Your name" htmlFor="name"><Input id="name" autoComplete="name" required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password" htmlFor="password" hint={<span className={pwOk ? "text-emerald-600" : undefined}>At least 8 characters, with a letter and a number{pwOk && " ✓"}</span>}>
          <PasswordInput id="password" autoComplete="new-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        <label className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[hsl(var(--brand))]" />
          <span>I agree to the <Link href="/terms" target="_blank" className="text-brand underline">Terms of Service</Link> and <Link href="/privacy" target="_blank" className="text-brand underline">Privacy Policy</Link>.</span>
        </label>
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!f.name || !f.email || !pwOk}>Create account</Button>
      </form>
    </>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api("/api/auth/forgot", { method: "POST", json: { email } });
      setSent(r.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Header title="Reset your password" subtitle="Enter your account email and we'll send you a reset link." />
      {sent ? <Alert tone="success" title="Check your inbox">{sent} The link is valid for 1 hour.</Alert> : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link href="/login" className="text-brand hover:underline">Back to sign in</Link></p>
    </>
  );
}

export function ResetForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const { refreshUser } = useApp();
  const token = sp.get("token") || "";
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/reset", { method: "POST", json: { token, password: pw } });
      await refreshUser();
      toast.success("Password updated — you're signed in");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Header title="Choose a new password" subtitle="All other devices will be signed out." />
      {!token ? <Alert tone="error">This reset link is incomplete. <Link href="/forgot-password" className="underline">Request a new one</Link>.</Alert> : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="New password" htmlFor="pw" hint="At least 8 characters, with a letter and a number."><PasswordInput id="pw" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>Update password</Button>
        </form>
      )}
    </>
  );
}
