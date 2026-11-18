import { updateReminderDay } from "@/app/dashboard/actions";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
  if ((origin && origin !== appOrigin) || request.headers.get("sec-fetch-site") === "cross-site")
    return Response.json({ success: false }, { status: 403 });
  try {
    const { action, timezone } = await request.json();
    if ((action !== "done" && action !== "snooze") || typeof timezone !== "string")
      return Response.json({ success: false }, { status: 400 });
    const result = await updateReminderDay(action, timezone);
    return Response.json(result, { status: result.success ? 200 : 401 });
  } catch {
    return Response.json({ success: false }, { status: 400 });
  }
}
