import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/utils/auth/server";

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/dashboard");

  return children;
}
