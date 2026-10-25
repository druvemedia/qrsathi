import { ApiError, handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { checkoutStatus } from "@/lib/billing";

export const GET = handle(async (req) => {
  const user = await requireUser();
  const id = new URL(req.url).searchParams.get("subscription") || "";
  if (!/^sub_[A-Za-z0-9]{6,40}$/.test(id)) throw new ApiError(400, "Missing subscription id.");
  return json(await checkoutStatus(user, id));
});
