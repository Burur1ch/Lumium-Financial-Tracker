import React from "react";
import { getCurrentPlan, getReportData } from "../actions";
import ReportContent from "@/components/dashboard/report-content";
import { canAccessAdvancedReports } from "@/utils/monetization/limits";

type Period = "7d" | "30d" | "3m" | "1y" | "all";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period = (
    ["7d", "30d", "3m", "1y", "all"].includes(rawPeriod ?? "")
      ? rawPeriod
      : "30d"
  ) as Period;

  const plan = await getCurrentPlan();
  const hasReportsAccess = canAccessAdvancedReports(plan);
  const data = hasReportsAccess ? await getReportData(period) : null;

  return (
    <ReportContent
      data={data}
      period={period}
      hasReportsAccess={hasReportsAccess}
    />
  );
}
