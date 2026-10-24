import { redirect } from "next/navigation";

export default function ArchivedPage() {
  redirect("/me/posts?scope=archived");
}
