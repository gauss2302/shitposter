// app/(dashboard)/dashboard/compose/page.tsx
import { redirect } from "next/navigation";

export default async function ComposePage() {
  // Redirect to posts page where the modal is now located
  redirect("/dashboard/posts");
}
