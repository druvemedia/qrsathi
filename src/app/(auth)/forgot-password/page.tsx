import type { Metadata } from "next";
import { ForgotForm } from "../auth-ui";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return <ForgotForm />;
}
