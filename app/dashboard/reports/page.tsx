import React from "react";
import { getReportData } from "../actions";
import ReportContent from "@/components/dashboard/report-content";

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

  const data = await getReportData(period);

  return <ReportContent data={data} period={period} />;
}
