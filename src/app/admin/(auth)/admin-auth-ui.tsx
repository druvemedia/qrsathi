"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound } from "lucide-react";
import { api } from "@/lib/fetcher";
import { safeNextPath } from "@/lib/safe-redirect";
import { LogoMark } from "@/components/brand";
import { useApp } from "@/components/providers";
import { ThemeToggle } from "@/components/user-menu";
import { Alert, Button, Field, Input } from "@/components/ui";

export function AdminAuthHeader() {
  const { settings } = useApp();
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
      <span className="flex items-center gap-2.5">
        <LogoMark className="h-7 w-7" />
        <span className="text-sm font-semibold">{settings.siteName}</span>
        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Admin</span>
      </span>
      <ThemeToggle />
    </header>
  );
}

function Title({ title, subtitle }: { title: string; subtitle: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}

/** Admin console paths only; anything else falls back to /admin. */
const adminNext = (n: string | null) => {
  const p = safeNextPath(n, "/admin");
  return p === "/admin" || p.startsWith("/admin/") ? p : "/admin";
};

export function AdminLoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = adminNext(sp.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [ticket, setTicket] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const done = (mfaSetupRequired?: boolean) => {
    router.replace(mfaSetupRequired ? "/admin/mfa" : next);
    router.refresh();
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/admin/auth/login", { method: "POST", json: { email, password } });
      setPassword("");
      if (r.mfaRequired) setTicket(r.ticket);
      else done(r.mfaSetupRequired);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/admin/auth/mfa", { method: "POST", json: useRecovery ? { ticket, recoveryCode: code } : { ticket, code } });
      if (typeof r.recoveryCodesRemaining === "number") setNotice(`Recovery code used. ${r.recoveryCodesRemaining} remaining.`);
      done();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      setError(msg);
      if (/expired/i.test(msg)) { setTicket(""); setCode(""); }
    } finally {
      setBusy(false);
    }
  };

  if (ticket)
    return (
      <>
        <Title title="Two-factor verification" subtitle={useRecovery ? "Enter one of your saved recovery codes. Each code works once." : "Enter the 6-digit code from your authenticator app."} />
        <form onSubmit={submitCode} className="space-y-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          {notice && <Alert tone="success">{notice}</Alert>}
          <Field label={useRecovery ? "Recovery code" : "Authentication code"} htmlFor="code">
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus autoComplete="one-time-code"
              inputMode={useRecovery ? "text" : "numeric"} pattern={useRecovery ? undefined : "[0-9]*"} maxLength={useRecovery ? 40 : 6}
              placeholder={useRecovery ? "xxxx-xxxx-xxxx-xxxx" : "123456"} className="font-mono tracking-widest" />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!code.trim()}>Verify</Button>
        </form>
        <div className="mt-5 flex items-center justify-between text-sm">
          <button type="button" onClick={() => { setTicket(""); setCode(""); setError(""); }} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            <ArrowLeft className="h-3.5 w-3.5" /> Start over
          </button>
          <button type="button" onClick={() => { setUseRecovery((v) => !v); setCode(""); setError(""); }} className="inline-flex items-center gap-1 text-brand hover:underline">
            <KeyRound className="h-3.5 w-3.5" /> {useRecovery ? "Use authenticator" : "Use a recovery code"}
          </button>
        </div>
      </>
    );

  return (
    <>
      <Title title="Administrator sign-in" subtitle="For platform administrators only. Customers sign in on the main site." />
      <form onSubmit={submitPassword} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password">
          <div className="relative">
            <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-700" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!email || !password}>Sign in</Button>
      </form>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/admin/forgot-password" className="text-brand hover:underline">Forgot password?</Link>
        <Link href="/login" className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Customer sign-in</Link>
      </div>
    </>
  );
}

export function AdminForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      // Shared, non-enumerating reset flow: same response whether or not the account exists.
      const r = await api("/api/auth/forgot", { method: "POST", json: { email } });
      setSent(r.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Title title="Reset administrator password" subtitle="We'll email a one-time reset link valid for 1 hour." />
      {sent ? (
        <Alert tone="success" title="Check your inbox">
          {sent} After resetting, sign in again at the admin console. Two-factor authentication stays enabled. If you&apos;ve lost your authenticator and recovery codes, ask a super administrator or the server operator to run the MFA reset command.
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!email}>Send reset link</Button>
        </form>
      )}
      <p className="mt-5 text-sm"><Link href="/admin/login" className="inline-flex items-center gap-1 text-brand hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Back to admin sign-in</Link></p>
    </>
  );
}
