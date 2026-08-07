"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function createTransaction(formData: FormData) {
  const supabase = await createClient();

  // 1. Проверяем авторизацию пользователя
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: "Неавторизован" };
  }

  // 2. Считываем данные из полей формы
  const description = formData.get("description") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const type = formData.get("type") as "expense" | "income";
  const status = formData.get("status") as "completed" | "pending";

  // В реальном приложении здесь будет ID выбранной категории.
  // Пока передаем null или дефолтную категорию, если таблица пустая.
  const category_id = (formData.get("category_id") as string) || null;

  if (!description || isNaN(amount)) {
    return { success: false, error: "Заполните все обязательные поля" };
  }

  // 3. Вставляем запись в таблицу transactions
  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    category_id,
    description,
    amount,
    type,
    status,
    date: new Date().toISOString(),
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // 4. Сбрасываем кэш страницы дашборда, чтобы графики и таблицы сразу обновились
  revalidatePath("/dashboard");
  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();

  // Разлогиниваем пользователя в Supabase Auth
  await supabase.auth.signOut();

  // Сбрасываем кэш и перенаправляем на логин
  revalidatePath("/", "layout");
}

// Получить все категории текущего пользователя
export async function getCategories() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Ошибка получения категорий:", error.message);
    return [];
  }

  return data;
}

// Создать новую кастомную категорию
export async function createCategory(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Неавторизован" };

  const name = formData.get("name") as string;
  const type = formData.get("type") as "expense" | "income";
  const color = formData.get("color") as string;
  const icon = (formData.get("icon") as string) || "tag";

  if (!name || !color) {
    return { success: false, error: "Заполните все поля" };
  }

  const { error } = await supabase.from("categories").insert({
    user_id: user.id,
    name,
    type,
    color,
    icon,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/categories");
  return { success: true };
}

// Удалить категорию
export async function deleteCategory(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Неавторизован" };

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/categories");
  return { success: true };
}

// Получение транзакций с учетом поиска и фильтров
export async function getFilteredTransactions(filters: {
  search?: string;
  type?: string;
  categoryId?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // Начинаем строить запрос с JOIN-ом категорий
  let query = supabase
    .from("transactions")
    .select(
      "id, description, amount, type, status, date, category_id, categories(name, color)",
    )
    .eq("user_id", user.id);

  // Фильтр по поисковому слову (регистронезависимый поиск)
  if (filters.search) {
    query = query.ilike("description", `%${filters.search}%`);
  }

  // Фильтр по типу (expense / income)
  if (filters.type && filters.type !== "all") {
    query = query.eq("type", filters.type);
  }

  // Фильтр по конкретной категории
  if (filters.categoryId && filters.categoryId !== "all") {
    query = query.eq("category_id", filters.categoryId);
  }

  // Сортируем: сначала самые новые
  const { data, error } = await query.order("date", { ascending: false });

  if (error) {
    console.error("Ошибка фильтрации транзакций:", error.message);
    return [];
  }

  return data;
}

// Получение бюджетов с агрегацией текущих расходов за текущий месяц
export async function getBudgetsWithProgress() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // 1. Получаем лимиты бюджетов за текущий месяц
  const now = new Date();
  const currentMonthYear = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const { data: budgets, error: budgetError } = await supabase
    .from("budgets")
    .select("id, monthly_limit, category_id, categories(name, color)")
    .eq("user_id", user.id)
    .eq("month_year", currentMonthYear);

  if (budgetError) {
    console.error("Ошибка получения бюджетов:", budgetError.message);
    return [];
  }

  // 2. Получаем расходы за текущий месяц для расчета прогресса
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("amount, category_id")
    .eq("user_id", user.id)
    .eq("type", "expense")
    .gte("date", startOfMonth.toISOString());

  if (txError) {
    console.error("Ошибка получения транзакций для бюджета:", txError.message);
    return budgets.map((b) => ({ ...b, current_spent: 0 }));
  }

  // Считаем сумму расходов по каждой категории
  const spentMap: Record<string, number> = {};
  transactions.forEach((tx) => {
    spentMap[tx.category_id] =
      (spentMap[tx.category_id] || 0) + Number(tx.amount);
  });

  // Объединяем лимиты с реальными расходами
  return budgets.map((b) => ({
    ...b,
    current_spent: spentMap[b.category_id] || 0,
  }));
}

// Создание или обновление лимита бюджета (Upsert)
export async function upsertBudget(formData: {
  categoryId: string;
  limitAmount: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // month_year хранит первый день текущего месяца
  const now = new Date();
  const monthYear = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const { error } = await supabase.from("budgets").upsert(
    {
      user_id: user.id,
      category_id: formData.categoryId,
      monthly_limit: formData.limitAmount,
      month_year: monthYear,
    },
    { onConflict: "user_id,category_id,month_year" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

// Получить профиль текущего пользователя
export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, name, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    data ?? { id: user.id, name: "", email: user.email ?? "", avatar_url: null }
  );
}

// Загрузить аватар
export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const file = formData.get("avatar") as File;
  if (!file || !file.size) return { success: false, error: "No file" };

  const ext = file.name.split(".").pop();
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatar")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { success: false, error: uploadError.message };

  const { data: urlData } = supabase.storage.from("avatar").getPublicUrl(path);

  const avatar_url = `${urlData.publicUrl}?t=${Date.now()}`;

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, avatar_url, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/settings");
  return { success: true, avatar_url };
}

// Обновить профиль
export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const name = formData.get("name") as string;
  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, name, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/settings");
  return { success: true };
}

// Удалить аккаунт
export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  // Удаляем транзакции, категории, бюджеты — каскадно через RLS или вручную
  await Promise.all([
    supabase.from("transactions").delete().eq("user_id", user.id),
    supabase.from("budgets").delete().eq("user_id", user.id),
    supabase.from("categories").delete().eq("user_id", user.id),
  ]);

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { success: true };
}
export async function getReportData(period: string = "30d") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date();
  let periodStart: Date | null = null;
  switch (period) {
    case "7d":
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - 7);
      break;
    case "30d":
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - 30);
      break;
    case "3m":
      periodStart = new Date(now);
      periodStart.setMonth(now.getMonth() - 3);
      break;
    case "1y":
      periodStart = new Date(now);
      periodStart.setFullYear(now.getFullYear() - 1);
      break;
    case "all":
      periodStart = null;
      break;
  }

  let query = supabase
    .from("transactions")
    .select("id, amount, type, date, category_id, categories(name, color)")
    .eq("user_id", user.id);
  if (periodStart) query = query.gte("date", periodStart.toISOString());

  const { data: transactions, error } = await query.order("date", {
    ascending: true,
  });
  if (error || !transactions) return null;

  // Aggregations
  let totalIncome = 0;
  let totalExpense = 0;
  const byMonth: Record<string, { income: number; expense: number }> = {};
  const byCategory: Record<
    string,
    { name: string; color: string; income: number; expense: number }
  > = {};
  const byDay: Record<string, { income: number; expense: number }> = {};

  transactions.forEach((tx) => {
    const amount = Number(tx.amount);
    const date = new Date(tx.date);
    const monthKey = date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    const dayKey = date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
    });
    const cat = Array.isArray(tx.categories) ? tx.categories[0] : tx.categories;
    const catName = cat?.name || "Uncategorized";
    const catColor = cat?.color || "#94a3b8";
    const catKey = tx.category_id || "uncategorized";

    if (!byMonth[monthKey]) byMonth[monthKey] = { income: 0, expense: 0 };
    if (!byDay[dayKey]) byDay[dayKey] = { income: 0, expense: 0 };
    if (!byCategory[catKey])
      byCategory[catKey] = {
        name: catName,
        color: catColor,
        income: 0,
        expense: 0,
      };

    if (tx.type === "income") {
      totalIncome += amount;
      byMonth[monthKey].income += amount;
      byDay[dayKey].income += amount;
      byCategory[catKey].income += amount;
    } else {
      totalExpense += amount;
      byMonth[monthKey].expense += amount;
      byDay[dayKey].expense += amount;
      byCategory[catKey].expense += amount;
    }
  });

  // Top spending categories
  const topExpenseCategories = Object.values(byCategory)
    .filter((c) => c.expense > 0)
    .sort((a, b) => b.expense - a.expense)
    .slice(0, 6);

  // Top income categories
  const topIncomeCategories = Object.values(byCategory)
    .filter((c) => c.income > 0)
    .sort((a, b) => b.income - a.income)
    .slice(0, 6);

  // Monthly trend (sorted)
  const monthlyTrend = Object.entries(byMonth).map(([label, v]) => ({
    label,
    ...v,
  }));

  // Daily trend — only for short periods
  const dailyTrend = Object.entries(byDay).map(([label, v]) => ({
    label,
    ...v,
  }));

  // Largest transactions
  const largest = [...transactions]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map((tx) => ({
      id: tx.id,
      description: "Transaction",
      amount: Number(tx.amount),
      type: tx.type as "income" | "expense",
      date: tx.date,
      category:
        (Array.isArray(tx.categories) ? tx.categories[0] : tx.categories)
          ?.name || "Uncategorized",
      color:
        (Array.isArray(tx.categories) ? tx.categories[0] : tx.categories)
          ?.color || "#94a3b8",
    }));

  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100)
      : 0;
  const avgDailyExpense =
    transactions.filter((t) => t.type === "expense").length > 0
      ? totalExpense /
        Math.max(1, dailyTrend.filter((d) => d.expense > 0).length)
      : 0;

  return {
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    savingsRate,
    avgDailyExpense,
    monthlyTrend,
    dailyTrend,
    topExpenseCategories,
    topIncomeCategories,
    largest,
    txCount: transactions.length,
  };
}
