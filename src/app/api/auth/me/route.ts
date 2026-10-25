import { handle, json } from "@/lib/api";
import { getUser, publicUser } from "@/lib/session";

export const GET = handle(async () => {
  const u = await getUser();
  return json({ user: u ? publicUser(u) : null });
});
