import { getCategories } from "../actions";
import { CategoriesContent } from "@/components/dashboard/categories-content";
export default async function CategoriesPage() {
  return <CategoriesContent initialCategories={await getCategories()} />;
}
