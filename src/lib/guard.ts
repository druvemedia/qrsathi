import { notFound, redirect } from "next/navigation";
import { getUser } from "./session";

/** Server-component guard: redirects guests to the login page. */
export async function requirePageUser(next: string) {
  const u = await getUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

/** Admin pages 404 for everyone else so their existence isn't revealed. */
export async function requirePageAdmin() {
  const u = await requirePageUser("/admin");
  if (u.role !== "admin") notFound();
  return u;
}
