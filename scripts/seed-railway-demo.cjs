// CommonJS keeps this operational script executable through Railway SSH.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pg = require("pg");

const { Client } = pg;
void (async () => {
const args = new Set(process.argv.slice(2));
const emailArgIndex = process.argv.indexOf("--email");
const requestedEmail = emailArgIndex >= 0 ? process.argv[emailArgIndex + 1] : null;
const userIdArgIndex = process.argv.indexOf("--user-id");
const requestedUserId = userIdArgIndex >= 0 ? process.argv[userIdArgIndex + 1] : null;
const inspectOnly = !args.has("--seed");
const connectionString = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_PUBLIC_URL or DATABASE_URL is required");
}

function maskEmail(email) {
  const [local, domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

const client = new Client({ connectionString });
await client.connect();

try {
  const usersResult = await client.query(
    `select id, email from "user" order by created_at desc`,
  );
  const users = usersResult.rows;

  if (inspectOnly) {
    const inspectedUsers = [];
    for (const user of users) {
      const activity = await client.query(
        `select count(*)::int as transaction_count,
                count(*) filter (where idempotency_key like 'demo-reference-v1-%')::int as seeded_transaction_count,
                (array_agg(description order by date desc))[1] as latest_description,
                max(date) as latest_date
         from transactions where user_id = $1`,
        [user.id],
      );
      const presetCount = await client.query(
        `select count(*)::int as count from quick_transaction_presets where user_id = $1`,
        [user.id],
      );
      const budgetCount = await client.query(
        `select count(*)::int as count from budgets where user_id = $1`,
        [user.id],
      );
      inspectedUsers.push({
        id: user.id,
        email: maskEmail(user.email),
        transactionCount: activity.rows[0].transaction_count,
        seededTransactionCount: activity.rows[0].seeded_transaction_count,
        quickPresetCount: presetCount.rows[0].count,
        budgetCount: budgetCount.rows[0].count,
        latestDescription: activity.rows[0].latest_description,
        latestDate: activity.rows[0].latest_date,
      });
    }
    console.log(JSON.stringify({
      mode: "inspect",
      userCount: users.length,
      users: inspectedUsers,
    }));
    process.exitCode = 0;
  } else {
    const target = requestedUserId
      ? users.find((user) => user.id === requestedUserId)
      : requestedEmail
        ? users.find((user) => user.email.toLowerCase() === requestedEmail.toLowerCase())
      : users.length === 1
        ? users[0]
        : null;

    if (!target) {
      throw new Error(
        requestedEmail || requestedUserId
          ? "Requested user was not found"
          : "More than one user exists. Pass --email or --user-id.",
      );
    }

    let bynPerUsd = 3.01;
    try {
      const response = await fetch(
        "https://api.nbrb.by/exrates/rates?periodicity=0",
        { headers: { Accept: "application/json" } },
      );
      if (response.ok) {
        const rates = await response.json();
        const usd = Array.isArray(rates)
          ? rates.find((rate) => rate?.Cur_Abbreviation === "USD")
          : null;
        if (
          usd &&
          Number.isFinite(usd.Cur_OfficialRate) &&
          Number.isFinite(usd.Cur_Scale) &&
          usd.Cur_Scale > 0
        ) {
          bynPerUsd = usd.Cur_OfficialRate / usd.Cur_Scale;
        }
      }
    } catch {
      // The app uses the same fallback when NBRB is temporarily unavailable.
    }
    const toUsd = (amountInByn) => (amountInByn / bynPerUsd).toFixed(2);

    const categoryDefinitions = [
      { key: "groceries", name: "Продукты", type: "expense", color: "#22c55e", icon: "shopping-basket", aliases: ["продукты", "groceries", "food"] },
      { key: "transport", name: "Транспорт", type: "expense", color: "#ef4444", icon: "bus", aliases: ["транспорт", "transport"] },
      { key: "cafe", name: "Кафе", type: "expense", color: "#a16207", icon: "coffee", aliases: ["кафе", "cafe", "coffee"] },
      { key: "housing", name: "Жильё", type: "expense", color: "#10b981", icon: "house", aliases: ["жильё", "жилье", "housing", "home"] },
      { key: "salary", name: "Зарплата", type: "income", color: "#10b981", icon: "wallet", aliases: ["зарплата", "salary", "income"] },
    ];

    await client.query("begin");
    const categoryIds = new Map();

    for (const category of categoryDefinitions) {
      const existing = await client.query(
        `select id from categories
         where user_id = $1 and type = $2 and lower(name) = any($3::text[])
         order by created_at asc limit 1`,
        [target.id, category.type, category.aliases],
      );
      let categoryId = existing.rows[0]?.id;
      if (!categoryId) {
        const inserted = await client.query(
          `insert into categories (user_id, name, type, color, icon)
           values ($1, $2, $3, $4, $5) returning id`,
          [target.id, category.name, category.type, category.color, category.icon],
        );
        categoryId = inserted.rows[0].id;
      }
      categoryIds.set(category.key, categoryId);
    }

    const now = new Date();
    const samples = [
      [28, "Зарплата", 4200.00, "income", "salary", "salary"],
      [27, "Аренда квартиры", 950.00, "expense", "housing", "rent"],
      [24, "Продукты", 84.35, "expense", "groceries", "groceries-1"],
      [22, "Метро", 2.40, "expense", "transport", "metro-1"],
      [19, "Кофе", 7.80, "expense", "cafe", "coffee-1"],
      [17, "Продукты", 64.19, "expense", "groceries", "groceries-2"],
      [15, "Обед", 34.50, "expense", "cafe", "lunch-1"],
      [14, "Фриланс", 650.00, "income", "salary", "freelance"],
      [13, "Такси", 25.00, "expense", "transport", "taxi-1"],
      [11, "Коммунальные услуги", 140.00, "expense", "housing", "utilities"],
      [9, "Продукты", 72.48, "expense", "groceries", "groceries-3"],
      [7, "Кофе", 8.20, "expense", "cafe", "coffee-2"],
      [5, "Автобус", 2.40, "expense", "transport", "bus-1"],
      [4, "Продукты", 119.73, "expense", "groceries", "groceries-4"],
      [3, "Такси", 24.50, "expense", "transport", "taxi-2"],
      [2, "Обед", 18.90, "expense", "cafe", "lunch-2"],
      [1, "Метро", 1.11, "expense", "transport", "metro-2"],
      [0, "Продукты", 45.67, "expense", "groceries", "groceries-5"],
    ];

    let syncedTransactions = 0;
    for (const [daysAgo, description, amount, type, categoryKey, sampleKey] of samples) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() - daysAgo);
      date.setUTCHours(7 + (daysAgo % 8), (daysAgo * 7) % 60, 0, 0);
      const inserted = await client.query(
        `insert into transactions
          (user_id, category_id, description, amount, type, status, review_status, date, idempotency_key)
         values ($1, $2, $3, $4, $5, 'completed', 'reviewed', $6, $7)
         on conflict (user_id, idempotency_key) do update
           set amount = excluded.amount,
               category_id = excluded.category_id,
               description = excluded.description,
               type = excluded.type,
               date = excluded.date
         returning id`,
        [target.id, categoryIds.get(categoryKey), description, toUsd(amount), type, date, `demo-reference-v1-${sampleKey}`],
      );
      syncedTransactions += inserted.rowCount ?? 0;
    }

    const presets = [
      ["Метро", 2.40, "train", "transport", 0],
      ["Кофе", 7.80, "coffee", "cafe", 1],
      ["Обед", 18.90, "utensils", "cafe", 2],
      ["Такси", 25.00, "bus", "transport", 3],
      ["Продукты", 45.00, "shopping", "groceries", 4],
    ];
    let insertedPresets = 0;
    for (const [name, amount, icon, categoryKey, sortOrder] of presets) {
      const inserted = await client.query(
        `insert into quick_transaction_presets
          (user_id, category_id, name, amount, type, icon, sort_order)
         select $1, $2, $3::varchar(80), $4::numeric, 'expense', $5::varchar(32), $6::integer
         where not exists (
           select 1 from quick_transaction_presets
           where user_id = $1 and lower(name) = lower($3::text)
         ) returning id`,
        [target.id, categoryIds.get(categoryKey), name, toUsd(amount), icon, sortOrder],
      );
      insertedPresets += inserted.rowCount ?? 0;
      await client.query(
        `update quick_transaction_presets
         set amount = $1, category_id = $2, icon = $3, sort_order = $4, updated_at = now()
         where user_id = $5 and lower(name) = lower($6::text)`,
        [toUsd(amount), categoryIds.get(categoryKey), icon, sortOrder, target.id, name],
      );
    }

    const monthYear = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const budgets = [
      ["housing", 1500.00],
      ["groceries", 800.00],
      ["transport", 250.00],
    ];
    let syncedBudgets = 0;
    for (const [categoryKey, limit] of budgets) {
      const inserted = await client.query(
        `insert into budgets (user_id, category_id, monthly_limit, month_year)
         values ($1, $2, $3, $4)
         on conflict (user_id, category_id, month_year) do update
           set monthly_limit = excluded.monthly_limit
         returning id`,
        [target.id, categoryIds.get(categoryKey), toUsd(limit), monthYear],
      );
      syncedBudgets += inserted.rowCount ?? 0;
    }

    await client.query("commit");
    console.log(JSON.stringify({
      mode: "seed",
      user: maskEmail(target.email),
      syncedTransactions,
      insertedPresets,
      syncedBudgets,
      bynPerUsd,
    }));
  }
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
