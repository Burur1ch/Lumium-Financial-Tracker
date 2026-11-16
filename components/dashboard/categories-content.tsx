"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Archive, ChevronDown, Pencil, Plus, X } from "lucide-react";
import {
  createCategory,
  getCategories,
  setCategoryArchived,
  updateCategory,
} from "@/app/dashboard/actions";
import { useI18n } from "@/hooks/useI18n";
import {
  CATEGORY_CATALOG,
  categoryLabel,
  categoryTranslationKey,
} from "@/utils/category-catalog";
import { CategoryArtwork } from "./category-artwork";

type Category = Awaited<ReturnType<typeof getCategories>>[number];
const field =
  "min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export function CategoriesContent({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const { t } = useI18n();
  const [categories, setCategories] = useState(initialCategories);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [editor, setEditor] = useState<{
    category?: Category;
    parent?: Category;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!editor) return;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditor(null);
      if (event.key !== "Tab") return;
      const elements = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not([type="hidden"]), select:not(:disabled)',
      );
      if (!elements?.length) return;
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [editor]);
  const refresh = async () => setCategories(await getCategories());
  const archive = (category: Category) =>
    startTransition(async () => {
      try {
        const result = await setCategoryArchived(
          category.id,
          !category.is_archived,
        );
        if (!result.success) setError(t("genericError"));
        else await refresh();
      } catch {
        setError(t("genericError"));
      }
    });
  const submit = (form: FormData) =>
    startTransition(async () => {
      setError("");
      try {
        const result = editor?.category
          ? await updateCategory(editor.category.id, form)
          : await createCategory(form);
        if (!result.success) {
          setError(
            t(
              result.error === "DUPLICATE_CATEGORY"
                ? "categoryAlreadyExists"
                : result.error === "INVALID_PARENT"
                  ? "categoryInvalidParent"
                  : result.error === "CATEGORY_IN_USE"
                    ? "categoryInUse"
                    : "categoryCreateFailed",
            ),
          );
          return;
        }
        await refresh();
        setEditor(null);
      } catch {
        setError(t("genericError"));
      }
    });
  const label = (c: Category) => categoryLabel(c, t);
  const roots = categories.filter((c) => c.type === type && !c.parent_id);
  const matches = (c: Category) =>
    label(c).toLocaleLowerCase().includes(search.toLocaleLowerCase());
  const renderGroup = (root: Category) => {
    const children = categories.filter((c) => c.parent_id === root.id);
    if (search && !matches(root) && !children.some(matches)) return null;
    return (
      <details
        key={root.id}
        open={search ? true : undefined}
        className="group overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      >
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-red-500">
          <CategoryArtwork
            icon={root.icon}
            name={root.name}
            className="h-10 w-10 shrink-0 rounded-xl"
            fallback={
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: root.color }}
              />
            }
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {label(root)}
            </span>
            <span className="text-xs text-slate-500">
              {children.filter((c) => !c.is_archived).length}{" "}
              {t("subcategories").toLocaleLowerCase()}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-slate-100 px-4 pb-3 dark:border-slate-800">
          <div className="flex flex-wrap gap-2 py-3">
            {!root.is_archived && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError("");
                  setEditor({ parent: root });
                }}
                className="flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("addSubcategory")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setError("");
                setEditor({ category: root });
              }}
              className="min-h-9 rounded-lg px-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t("categoryEdit")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => archive(root)}
              className="min-h-9 rounded-lg px-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t(root.is_archived ? "categoryRestore" : "categoryArchive")}
            </button>
          </div>
          {children
            .filter((c) => !search || matches(c) || matches(root))
            .map((child) => (
              <div
                key={child.id}
                className={`flex min-h-12 items-center gap-2 border-t border-slate-100 pl-3 dark:border-slate-800 ${child.is_archived ? "opacity-60" : ""}`}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: child.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                  {label(child)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setEditor({ category: child });
                  }}
                  aria-label={`${t("categoryEdit")}: ${label(child)}`}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={pending || root.is_archived}
                  onClick={() => archive(child)}
                  aria-label={`${t(child.is_archived ? "categoryRestore" : "categoryArchive")}: ${label(child)}`}
                  className="min-h-10 rounded-lg px-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t(child.is_archived ? "categoryRestore" : "categoryArchive")}
                </button>
              </div>
            ))}
        </div>
      </details>
    );
  };
  const editorType = editor?.category?.type ?? editor?.parent?.type ?? type;
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="hidden text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50 lg:block">
            {t("categories")}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            {t("categoryHierarchyHelp")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError("");
            setEditor({});
          }}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-red-500 px-4 text-sm font-semibold text-white hover:bg-red-600"
        >
          <Plus className="h-4 w-4" />
          {t("createCategory")}
        </button>
      </div>
      <div className="flex gap-2">
        {(["expense", "income"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={type === value}
            onClick={() => setType(value)}
            className={`min-h-10 rounded-full px-4 text-sm font-semibold ${type === value ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
          >
            {t(value)}
          </button>
        ))}
      </div>
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label={t("categorySearch")}
        placeholder={t("categorySearch")}
        className={field}
      />
      {error && !editor && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
      <div className="grid items-start gap-3 md:grid-cols-2">
        {roots.filter((c) => !c.is_archived).map(renderGroup)}
      </div>
      <details className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-800/50">
        <summary className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Archive className="h-4 w-4" />
          {t("archivedCategories")}
        </summary>
        <p className="mb-4 mt-2 text-xs leading-5 text-slate-500">
          {t("categoryArchiveHelp")}
        </p>
        <div className="grid items-start gap-3 md:grid-cols-2">
          {roots.filter((c) => c.is_archived).map(renderGroup)}
        </div>
      </details>
      {editor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditor(null);
          }}
        >
          <section
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-editor-title"
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-slate-900 sm:rounded-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2
                id="category-editor-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                {t(
                  editor.category
                    ? "categoryEdit"
                    : editor.parent
                      ? "addSubcategory"
                      : "createCategory",
                )}
              </h2>
              <button
                type="button"
                onClick={() => setEditor(null)}
                aria-label={t("close")}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit(new FormData(event.currentTarget));
              }}
              className="space-y-4"
            >
              <label className="block space-y-1.5 text-xs font-semibold text-slate-500">
                <span>{t("categoryName")}</span>
                <input
                  name="name"
                  required
                  maxLength={60}
                  defaultValue={editor.category?.name ?? ""}
                  autoFocus
                  className={field}
                />
              </label>
              <input type="hidden" name="type" value={editorType} />
              <label className="block space-y-1.5 text-xs font-semibold text-slate-500">
                <span>{t("parentCategory")}</span>
                <select
                  name="parent_id"
                  defaultValue={
                    editor.category?.parent_id ?? editor.parent?.id ?? ""
                  }
                  disabled={Boolean(editor.category || editor.parent)}
                  className={field}
                >
                  <option value="">{t("rootCategory")}</option>
                  {categories
                    .filter(
                      (c) =>
                        !c.parent_id &&
                        c.type === editorType &&
                        (!c.is_archived || c.id === editor.category?.parent_id),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {label(c)}
                      </option>
                    ))}
                </select>
                {(editor.category || editor.parent) && (
                  <input
                    type="hidden"
                    name="parent_id"
                    value={
                      editor.category?.parent_id ?? editor.parent?.id ?? ""
                    }
                  />
                )}
              </label>
              <label className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                {t("selectColor")}
                <input
                  type="color"
                  name="color"
                  defaultValue={
                    editor.category?.color ?? editor.parent?.color ?? "#24845C"
                  }
                  className="h-10 w-16 rounded-lg border-0"
                />
              </label>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-500">
                <span>{t("selectIcon")}</span>
                <select
                  name="icon"
                  defaultValue={
                    editor.category?.icon ?? editor.parent?.icon ?? "tag"
                  }
                  className={field}
                >
                  {[
                    ...new Map(
                      CATEGORY_CATALOG.map((row) => [row[1], row]),
                    ).values(),
                  ].map((row) => (
                    <option key={row[1]} value={row[1]}>
                      {t(categoryTranslationKey(row[0]))}
                    </option>
                  ))}
                </select>
              </label>
              {error && (
                <p role="alert" className="text-sm text-red-500">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={pending}
                className="min-h-11 w-full rounded-xl bg-red-500 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("categorySave")}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
