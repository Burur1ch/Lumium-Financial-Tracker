export const QUICK_LAUNCH_ACTIONS = ["scan", "add", "quick"] as const;
export type QuickLaunchAction = (typeof QUICK_LAUNCH_ACTIONS)[number];

export function quickLaunchAction(value: unknown): QuickLaunchAction | null {
  return typeof value === "string" && QUICK_LAUNCH_ACTIONS.some((action) => action === value)
    ? value as QuickLaunchAction : null;
}

export function quickLaunchUrl(action: QuickLaunchAction | null) {
  return action ? `/dashboard?launch=${action}` : "/dashboard";
}

export function quickLaunchAuthUrl(page: "login" | "register", action: QuickLaunchAction | null) {
  return action ? `/${page}?launch=${action}` : `/${page}`;
}
