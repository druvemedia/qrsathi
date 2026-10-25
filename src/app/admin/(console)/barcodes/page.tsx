import { redirect } from "next/navigation";

export default function AdminBarcodesPage() {
  redirect("/admin/products#barcodes");
}
