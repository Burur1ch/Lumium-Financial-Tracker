import { getCardBalance } from "../actions";
import { CardBalanceContent } from "@/components/dashboard/card-balance-content";
import { auth } from "@/utils/auth/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function CardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  return <CardBalanceContent balance={await getCardBalance()} />;
}
