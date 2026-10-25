import { ShieldCheck } from "lucide-react";
import { AdminAuthHeader } from "./admin-auth-ui";

/** Minimal, separate frame for administrator sign-in (no marketing, no workspace UI). */
export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 dark:bg-slate-950">
      <AdminAuthHeader />
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="card p-6 sm:p-8">{children}</div>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Restricted area. Sign-in attempts are logged.
          </p>
        </div>
      </main>
    </div>
  );
}
