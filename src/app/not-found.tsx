import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-serif text-8xl gradient-text">404</p>
        <h1 className="mt-3 font-serif text-3xl font-medium">Page not found</h1>
        <p className="mt-2 text-slate-500">The page or QR code you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-brand px-5 py-2.5 font-semibold text-white">Go home</Link>
      </div>
    </div>
  );
}
