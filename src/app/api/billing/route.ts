import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { billingOverview } from "@/lib/billing";

/** The signed-in user's own billing status and payment history. */
export const GET = handle(async () => {
  const user = await requireUser();
  return json(await billingOverview(user));
});
