import { handle, json } from "@/lib/api";
import { destroySession } from "@/lib/session";

/** Ends this browser's workspace session server-side (the token stops working immediately). */
export const POST = handle(async () => {
  await destroySession("user");
  return json({ ok: true });
});
