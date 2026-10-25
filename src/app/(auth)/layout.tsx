import { AuthAside } from "./auth-ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthAside />
      <main id="main" className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
