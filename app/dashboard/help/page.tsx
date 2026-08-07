"use client";

import React, { useState, useTransition } from "react";
import { sendSupportEmail } from "./actions";
import {
  HelpCircle,
  BookOpen,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  Search,
  Send,
  CheckCircle2,
  ArrowUpRight,
  Zap,
  Shield,
  BarChart3,
  Wallet,
  Tag,
  Settings,
} from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQ_EN = [
  {
    q: "How do I add a transaction?",
    a: "Click the '+ Add Transaction' button on the Dashboard or Transactions page. Fill in the amount, category, description, and type (income or expense), then save.",
  },
  {
    q: "How do I create a budget limit?",
    a: "Go to the Budget page and click 'Set Category Limit'. Select a category, enter the monthly limit amount, and save. You'll see real-time progress for each limit.",
  },
  {
    q: "Can I create custom categories?",
    a: "Yes! Head to the Categories page. You can create expense or income categories with custom names and colors. Categories can also be created inline when adding a transaction.",
  },
  {
    q: "How does currency conversion work?",
    a: "Lumium stores all amounts in USD internally. When you change your display currency in Settings → Preferences, amounts are converted using fixed exchange rates for display purposes only. No actual conversion of your data occurs.",
  },
  {
    q: "How do I change the language?",
    a: "Open Settings → Preferences and select your language. The interface will update immediately across all pages.",
  },
  {
    q: "What periods can I view data for?",
    a: "You can filter by Last 7 days, Last 30 days, Last 3 months, Last year, or All time using the period selector at the top of most pages.",
  },
  {
    q: "How do I delete my account?",
    a: "Go to Settings → Danger Zone → Delete account. You'll need to type 'DELETE' to confirm. This action is irreversible and will permanently remove all your data.",
  },
  {
    q: "Is my financial data secure?",
    a: "Yes. Lumium uses Supabase with Row Level Security (RLS), meaning your data is isolated and only accessible by your authenticated account. All connections are encrypted with TLS.",
  },
];

const FAQ_RU = [
  {
    q: "Как добавить транзакцию?",
    a: "Нажмите кнопку '+ Добавить' на странице Дашборда или Транзакций. Заполните сумму, категорию, описание и тип (расход или доход), затем сохраните.",
  },
  {
    q: "Как установить лимит бюджета?",
    a: "Перейдите на страницу Бюджет и нажмите 'Установить лимит'. Выберите категорию, введите месячный лимит и сохраните. Вы увидите прогресс в реальном времени.",
  },
  {
    q: "Можно ли создавать собственные категории?",
    a: "Да! Перейдите на страницу Категории. Вы можете создавать категории расходов или доходов с произвольными названиями и цветами.",
  },
  {
    q: "Как работает конвертация валюты?",
    a: "Lumium хранит все суммы в USD. При изменении валюты в Настройках → Предпочтения суммы конвертируются по фиксированному курсу только для отображения. Данные не изменяются.",
  },
  {
    q: "Как изменить язык?",
    a: "Откройте Настройки → Предпочтения и выберите язык. Интерфейс обновится сразу на всех страницах.",
  },
  {
    q: "За какие периоды можно смотреть данные?",
    a: "Вы можете фильтровать по: последние 7 дней, 30 дней, 3 месяца, год или за всё время с помощью селектора периода.",
  },
  {
    q: "Как удалить аккаунт?",
    a: "Перейдите в Настройки → Опасная зона → Удалить аккаунт. Нужно ввести 'DELETE' для подтверждения. Это действие необратимо.",
  },
  {
    q: "Насколько защищены мои данные?",
    a: "Lumium использует Supabase с Row Level Security (RLS) — ваши данные изолированы и доступны только вашему аккаунту. Все соединения зашифрованы TLS.",
  },
];

const FAQ_DE = [
  {
    q: "Wie füge ich eine Transaktion hinzu?",
    a: "Klicken Sie auf '+ Hinzufügen' im Dashboard oder auf der Transaktionsseite. Füllen Sie Betrag, Kategorie, Beschreibung und Typ aus.",
  },
  {
    q: "Wie setze ich ein Budgetlimit?",
    a: "Gehen Sie zur Budgetseite und klicken Sie auf 'Limit setzen'. Wählen Sie eine Kategorie, geben Sie das Monatslimit ein und speichern Sie.",
  },
  {
    q: "Kann ich eigene Kategorien erstellen?",
    a: "Ja! Gehen Sie zur Kategorieseite und erstellen Sie Ausgaben- oder Einnahmekategorien mit eigenen Namen und Farben.",
  },
  {
    q: "Wie funktioniert die Währungsumrechnung?",
    a: "Lumium speichert alle Beträge in USD. Wenn Sie die Anzeigewährung in Einstellungen → Präferenzen ändern, werden Beträge nur zur Anzeige umgerechnet.",
  },
  {
    q: "Wie ändere ich die Sprache?",
    a: "Öffnen Sie Einstellungen → Präferenzen und wählen Sie Ihre Sprache. Die Benutzeroberfläche wird sofort aktualisiert.",
  },
  {
    q: "Für welche Zeiträume kann ich Daten anzeigen?",
    a: "Sie können nach Letzten 7 Tagen, 30 Tagen, 3 Monaten, Letztem Jahr oder Gesamter Zeit filtern.",
  },
  {
    q: "Wie lösche ich mein Konto?",
    a: "Gehen Sie zu Einstellungen → Gefahrenzone → Konto löschen. Sie müssen 'DELETE' eingeben zur Bestätigung.",
  },
  {
    q: "Sind meine Finanzdaten sicher?",
    a: "Ja. Lumium verwendet Supabase mit Row Level Security (RLS). Alle Verbindungen sind TLS-verschlüsselt.",
  },
];

const FAQ_FR = [
  {
    q: "Comment ajouter une transaction ?",
    a: "Cliquez sur '+ Ajouter' sur le tableau de bord ou la page Transactions. Remplissez le montant, la catégorie, la description et le type.",
  },
  {
    q: "Comment définir une limite de budget ?",
    a: "Allez sur la page Budget et cliquez sur 'Définir une limite'. Sélectionnez une catégorie, entrez la limite mensuelle et sauvegardez.",
  },
  {
    q: "Puis-je créer des catégories personnalisées ?",
    a: "Oui ! Rendez-vous sur la page Catégories pour créer des catégories de dépenses ou revenus avec des noms et couleurs personnalisés.",
  },
  {
    q: "Comment fonctionne la conversion de devise ?",
    a: "Lumium stocke tous les montants en USD. Lorsque vous changez la devise dans Paramètres → Préférences, les montants sont convertis à des taux fixes uniquement pour l'affichage.",
  },
  {
    q: "Comment changer la langue ?",
    a: "Ouvrez Paramètres → Préférences et sélectionnez votre langue. L'interface se met à jour immédiatement.",
  },
  {
    q: "Pour quelles périodes puis-je voir les données ?",
    a: "Vous pouvez filtrer par : 7 derniers jours, 30 jours, 3 mois, Dernière année ou Tout le temps.",
  },
  {
    q: "Comment supprimer mon compte ?",
    a: "Allez dans Paramètres → Zone de danger → Supprimer le compte. Vous devez taper 'DELETE' pour confirmer.",
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Oui. Lumium utilise Supabase avec Row Level Security (RLS). Toutes les connexions sont chiffrées TLS.",
  },
];

const FAQ_MAP: Record<string, typeof FAQ_EN> = {
  en: FAQ_EN,
  ru: FAQ_RU,
  de: FAQ_DE,
  fr: FAQ_FR,
};

// ─── Guides ───────────────────────────────────────────────────────────────────

const GUIDES = [
  {
    icon: Zap,
    titleKey: "addExpense",
    descKey: "gettingStarted",
    href: "/dashboard",
  },
  {
    icon: Tag,
    titleKey: "categories",
    descKey: "createCategory",
    href: "/dashboard/categories",
  },
  {
    icon: Wallet,
    titleKey: "budget",
    descKey: "budgetsLimits",
    href: "/dashboard/budget",
  },
  {
    icon: BarChart3,
    titleKey: "reports",
    descKey: "cashFlow",
    href: "/dashboard/reports",
  },
  {
    icon: Shield,
    titleKey: "dangerZone",
    descKey: "deleteAccount",
    href: "/dashboard/settings",
  },
  {
    icon: Settings,
    titleKey: "preferences",
    descKey: "currency",
    href: "/dashboard/settings",
  },
] as const;

// ─── Components ───────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 pr-4">
          {q}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-4 bg-white dark:bg-slate-900 text-sm text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const { t, language } = useI18n();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"faq" | "contact" | "docs">("faq");
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const faqs = FAQ_MAP[language] ?? FAQ_EN;
  const filtered = search.trim()
    ? faqs.filter(
        (f) =>
          f.q.toLowerCase().includes(search.toLowerCase()) ||
          f.a.toLowerCase().includes(search.toLowerCase()),
      )
    : faqs;

  const handleSend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSendError(null);
    startTransition(async () => {
      const result = await sendSupportEmail(form);
      if (result.success) {
        setSent(true);
        setForm({ name: "", email: "", subject: "", message: "" });
      } else {
        setSendError(result.error ?? "Unknown error");
      }
    });
  };

  const tabs = [
    { key: "faq" as const, label: t("faq"), icon: HelpCircle },
    {
      key: "contact" as const,
      label: t("contactSupport"),
      icon: MessageSquare,
    },
    { key: "docs" as const, label: t("documentation"), icon: FileText },
  ];

  const inputCls =
    "w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-800 dark:text-slate-200 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 placeholder-slate-400";

  return (
    <div className="p-4 md:p-8 space-y-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t("helpTitle")}
        </h1>
        <p className="text-xs md:text-sm text-slate-400 dark:text-slate-500 mt-1">
          {t("helpSubtitle")}
        </p>
      </div>

      {/* Quick guides grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {GUIDES.map(({ icon: Icon, titleKey, href }) => (
          <a
            key={titleKey}
            href={href}
            className="group flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-red-200 dark:hover:border-red-900/50 hover:shadow-md transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-red-500" />
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-red-500 transition-colors truncate">
              {t(titleKey)}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 ml-auto group-hover:text-red-400 transition-colors" />
          </a>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === key
                  ? "border-red-500 text-red-500"
                  : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {/* ── FAQ ── */}
          {activeTab === "faq" && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder={t("searchHelp")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={inputCls + " pl-10"}
                />
              </div>
              {/* Items */}
              <div className="space-y-2">
                {filtered.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
                    {t("noTransactions")}
                  </p>
                ) : (
                  filtered.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)
                )}
              </div>
            </div>
          )}

          {/* ── Contact ── */}
          {activeTab === "contact" && (
            <div className="max-w-lg">
              {sent ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                      {t("messageSent")}
                    </p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                      {t("messageSentDesc")}
                    </p>
                  </div>
                  <button
                    onClick={() => setSent(false)}
                    className="mt-2 text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                  >
                    {t("sendMessage")} →
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSend} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t("yourName")}
                      </label>
                      <input
                        required
                        className={inputCls}
                        placeholder="John Doe"
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t("yourEmail")}
                      </label>
                      <input
                        required
                        type="email"
                        className={inputCls}
                        placeholder="john@example.com"
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t("subject")}
                    </label>
                    <input
                      required
                      className={inputCls}
                      placeholder={t("subject")}
                      value={form.subject}
                      onChange={(e) =>
                        setForm({ ...form, subject: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {t("message")}
                    </label>
                    <textarea
                      required
                      rows={5}
                      className={inputCls + " resize-none"}
                      placeholder={t("message") + "..."}
                      value={form.message}
                      onChange={(e) =>
                        setForm({ ...form, message: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex justify-end">
                    {sendError && (
                      <p className="flex-1 text-xs font-semibold text-red-500 self-center">
                        {sendError}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={isPending}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-bold transition-colors"
                    >
                      {isPending ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      {t("send")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ── Docs ── */}
          {activeTab === "docs" && (
            <div className="space-y-3">
              {[
                {
                  icon: BookOpen,
                  title: t("gettingStarted"),
                  desc: t("helpSubtitle"),
                  badge: "v1.0",
                },
                {
                  icon: BarChart3,
                  title: t("reports"),
                  desc:
                    t("cashFlow") +
                    " · " +
                    t("netBalance") +
                    " · " +
                    t("savingsRate"),
                  badge: null,
                },
                {
                  icon: Wallet,
                  title: t("budgetsLimits"),
                  desc: t("monthlySpendingLimits"),
                  badge: null,
                },
                {
                  icon: Tag,
                  title: t("categories"),
                  desc: t("yourCategories") + " · " + t("createCategory"),
                  badge: null,
                },
                {
                  icon: Settings,
                  title: t("preferences"),
                  desc:
                    t("currency") +
                    " · " +
                    t("language") +
                    " · " +
                    t("dateFormat"),
                  badge: null,
                },
                {
                  icon: Shield,
                  title: t("dangerZone"),
                  desc: t("signOut") + " · " + t("deleteAccount"),
                  badge: null,
                },
              ].map(({ icon: Icon, title, desc, badge }) => (
                <div
                  key={title}
                  className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:border-red-200 dark:hover:border-red-900/40 transition-colors cursor-default"
                >
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center shrink-0 shadow-sm">
                    <Icon className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {title}
                      </p>
                      {badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-950/30 text-red-500">
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {t("stillNeedHelp")}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("stillNeedHelpDesc")}
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab("contact")}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
          {t("contactSupport")}
        </button>
      </div>

      {/* Version */}
      <p className="text-center text-[11px] text-slate-300 dark:text-slate-700">
        Lumium · {t("version")} 1.0.0
      </p>
    </div>
  );
}
