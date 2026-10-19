import { getExchangeRateSnapshot } from "@/utils/currency-server";

export async function GET() {
  const snapshot = await getExchangeRateSnapshot();

  return Response.json(snapshot, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=21600",
    },
  });
}
