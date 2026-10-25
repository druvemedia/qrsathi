import { redirect } from "next/navigation";

export default function AdminInventoryPage() {
  redirect("/admin/products#inventory");
}
