import { getCategories, getPlanningData } from "../actions";
import { PlanningContent } from "@/components/dashboard/planning-content";

export default async function PlanningPage() {
  const [categories, planning] = await Promise.all([
    getCategories(),
    getPlanningData(),
  ]);

  return <PlanningContent categories={categories} {...planning} />;
}
