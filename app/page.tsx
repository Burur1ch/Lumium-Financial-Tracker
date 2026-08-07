import { redirect } from "next/navigation";

export default function RootPage() {
  // Автоматически перенаправляем пользователя на /dashboard
  redirect("/dashboard");
}
