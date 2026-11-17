import { redirect } from "next/navigation";
import { getReportData } from "../actions";
import ReportContent from "@/components/dashboard/report-content";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const data = await getReportData(rawPeriod);
  if (!data) redirect("/login");
  if (rawPeriod && rawPeriod !== data.period)
    redirect(`/dashboard/reports?period=${data.period}`);
  return <ReportContent data={data} />;
}
