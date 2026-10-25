"use client";
/**
 * Admin form helpers: password re-confirmation for sensitive actions, and an
 * unsaved-changes guard (browser close/reload + in-app link navigation).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { FetchError, api } from "@/lib/fetcher";
import { Alert, Button, ConfirmDialog, Field, Input, Modal } from "@/components/ui";

/**
 * Wraps a sensitive request: if the server answers 403 { reauthRequired }, asks
 * for the password (and 2FA code) once, then retries the request.
 */
export function useReauth() {
  const [pending, setPending] = useState<{ resolve: (ok: boolean) => void } | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      const needs = e instanceof FetchError && e.status === 403 && (e.details as { reauthRequired?: boolean } | undefined)?.reauthRequired;
      if (!needs) throw e;
      const ok = await new Promise<boolean>((resolve) => setPending({ resolve }));
      if (!ok) throw new Error("Cancelled: password confirmation is required for this change.");
      return fn();
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/auth/reauth", { method: "POST", json: { password, code: code || undefined } });
      pending?.resolve(true);
      setPending(null);
      setPassword("");
      setCode("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't confirm";
      setError(msg);
      if (/code/i.test(msg)) setNeedCode(true);
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => { pending?.resolve(false); setPending(null); setError(""); };

  const dialog = (
    <Modal open={!!pending} onClose={cancel} size="sm" title="Confirm it's you" description="Payment credentials are sensitive. Re-enter your password to continue.">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Password" htmlFor="reauth-pw"><Input id="reauth-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <Field label="Authentication code" htmlFor="reauth-code" hint={needCode ? undefined : "Required if two-factor authentication is on."}>
          <Input id="reauth-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="w-36 font-mono tracking-widest" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={cancel}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!password}><ShieldCheck className="h-4 w-4" /> Confirm</Button>
        </div>
      </form>
    </Modal>
  );
  return { run, dialog };
}

/** Warns before leaving with unsaved changes: browser close/reload and clicks on in-app links. */
export function useUnsavedGuard(dirty: boolean) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setTarget(url.pathname + url.search);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", onClick, true); };
  }, []);

  const dialog = (
    <ConfirmDialog open={!!target} onClose={() => setTarget(null)} title="Discard unsaved changes?" confirmLabel="Leave without saving"
      onConfirm={() => { const t = target!; dirtyRef.current = false; setTarget(null); router.push(t); }}>
      You have changes on this page that haven&apos;t been saved.
    </ConfirmDialog>
  );
  return dialog;
}
