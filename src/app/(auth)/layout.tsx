import { AuthAside } from "./auth-ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-[#fbfbf9] dark:bg-[#0b0b0d] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <AuthAside />
      <main id="main" className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
