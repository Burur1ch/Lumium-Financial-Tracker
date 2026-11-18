"use client";

import { createScannedTransaction, createTransaction } from "@/app/dashboard/actions";

export interface CachedCategory {
  id: string;
  name: string;
  type: "expense" | "income";
  color: string;
  icon?: string | null;
  parent_id?: string | null;
  archived_at?: string | Date | null;
}

interface OfflineAccount {
  userId: string;
  categories: CachedCategory[];
}
type ReceiptInput = Parameters<typeof createScannedTransaction>[0];
type QueuedTransaction = {
  id: string;
  userId: string;
  createdAt: number;
  error?: string;
} & ({ kind: "manual"; fields: Record<string, string> } | { kind: "receipt"; input: ReceiptInput });

const ACCOUNT_KEY = "lumium_offline_account";
const QUEUE_PREFIX = "lumium_pending_";
const DRAFT_PREFIX = "lumium_draft_";

export function cachedOfflineAccount(): OfflineAccount | null {
  try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "null"); }
  catch { return null; }
}

export function cacheOfflineAccount(account: OfflineAccount) {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  window.dispatchEvent(new Event("lumium:account-cached"));
}

export function clearOfflineSession() {
  try { localStorage.removeItem(ACCOUNT_KEY); }
  catch { /* Signing out also works when browser storage is unavailable. */ }
}

export function clearOfflineAccountData(userId: string) {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(QUEUE_PREFIX + userId + "_") || key === DRAFT_PREFIX + userId)
      localStorage.removeItem(key);
  }
  if (cachedOfflineAccount()?.userId === userId) clearOfflineSession();
}

export function readTransactionDraft(): Record<string, string> | null {
  const account = cachedOfflineAccount();
  if (!account) return null;
  try { return JSON.parse(localStorage.getItem(DRAFT_PREFIX + account.userId) ?? "null"); }
  catch { return null; }
}

export function writeTransactionDraft(fields: Record<string, string> | null) {
  const account = cachedOfflineAccount();
  if (!account) return;
  if (fields) localStorage.setItem(DRAFT_PREFIX + account.userId, JSON.stringify(fields));
  else localStorage.removeItem(DRAFT_PREFIX + account.userId);
}

export function pendingTransactions(userId: string): QueuedTransaction[] {
  const items: QueuedTransaction[] = [];
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(QUEUE_PREFIX + userId + "_")) continue;
    try {
      const item: QueuedTransaction = JSON.parse(localStorage.getItem(key)!);
      if (item.userId === userId) items.push(item);
    } catch { /* An unreadable item never prevents other entries from syncing. */ }
  }
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export function removePendingTransaction(userId: string, id: string) {
  localStorage.removeItem(QUEUE_PREFIX + userId + "_" + id);
  window.dispatchEvent(new Event("lumium:queue-changed"));
}

function queueTransaction(item: QueuedTransaction) {
  localStorage.setItem(QUEUE_PREFIX + item.userId + "_" + item.id, JSON.stringify(item));
  window.dispatchEvent(new Event("lumium:queue-changed"));
  return { success: true as const, queued: true };
}

export async function submitManualTransaction(form: FormData) {
  const id = String(form.get("idempotency_key") || crypto.randomUUID());
  form.set("idempotency_key", id);
  const account = cachedOfflineAccount();
  if (account) form.set("expected_user_id", account.userId);
  const queue = () => {
    if (!account) throw new Error("OFFLINE_ACCOUNT_UNAVAILABLE");
    return queueTransaction({
      id, userId: account.userId, createdAt: Date.now(), kind: "manual",
      fields: Object.fromEntries(Array.from(form.entries(), ([key, value]) => [key, String(value)])),
    });
  };
  if (!navigator.onLine) return queue();
  try {
    const result = await createTransaction(form);
    if (result.success && account) removePendingTransaction(account.userId, id);
    return { ...result, queued: false };
  }
  catch { return queue(); }
}

export async function submitScannedTransaction(input: ReceiptInput) {
  input = { ...input, idempotencyKey: input.idempotencyKey ?? crypto.randomUUID() };
  const account = cachedOfflineAccount();
  if (account) input.expectedUserId = account.userId;
  const queue = () => {
    if (!account) throw new Error("OFFLINE_ACCOUNT_UNAVAILABLE");
    return queueTransaction({ id: input.idempotencyKey!, userId: account.userId, createdAt: Date.now(), kind: "receipt", input });
  };
  if (!navigator.onLine) return queue();
  try { return { ...await createScannedTransaction(input), queued: false }; }
  catch { return queue(); }
}

export async function flushTransactions(userId: string) {
  let sent = 0;
  let failed = false;
  for (const item of pendingTransactions(userId)) {
    if (!navigator.onLine || cachedOfflineAccount()?.userId !== userId) break;
    let result;
    if (item.kind === "receipt") result = await createScannedTransaction(item.input);
    else {
      const form = new FormData();
      Object.entries(item.fields).forEach(([key, value]) => form.set(key, value));
      result = await createTransaction(form);
    }
    if (!result.success) {
      failed = true;
      queueTransaction({ ...item, error: result.error || "INVALID_TRANSACTION" });
      if (result.error === "UNAUTHORIZED") break;
      continue;
    }
    removePendingTransaction(userId, item.id);
    sent++;
  }
  window.dispatchEvent(new Event("lumium:queue-changed"));
  return { sent, failed };
}
