import type { Metadata } from "next";
import { AdminForgotForm } from "../admin-auth-ui";

export const metadata: Metadata = { title: "Reset administrator password" };

export default function AdminForgotPage() {
  return <AdminForgotForm />;
}
