import { getCategories, getPlanningPageData } from "../actions";
import { PlanningContent } from "@/components/dashboard/planning-content";
import { redirect } from "next/navigation";

export default async function PlanningPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const [categories, planning] = await Promise.all([
    getCategories(),
    getPlanningPageData(month),
  ]);
  if (!planning) redirect("/login");
  return <PlanningContent categories={categories} {...planning} />;
}
