"use client";

import Image from "next/image";
import type { ReactNode } from "react";

const ICON_ASSETS: Record<string, string> = {
  shoppingCart: "groceries",
  "shopping-cart": "groceries",
  "shopping-basket": "groceries",
  shoppingBag: "shopping",
  utensils: "dining",
  pizza: "dining",
  wine: "dining",
  car: "transport",
  bus: "transport",
  fuel: "transport",
  home: "housing",
  house: "housing",
  heart: "health",
  stethoscope: "health",
  gamepad: "entertainment",
  music: "entertainment",
  tv: "entertainment",
  plane: "travel",
  graduationCap: "education",
  "graduation-cap": "education",
  book: "education",
  briefcase: "salary",
  banknote: "salary",
  wallet: "savings",
  gift: "gifts",
  coffee: "coffee",
  creditCard: "subscriptions",
  phone: "subscriptions",
  zap: "utilities",
  wifi: "utilities",
  wrench: "utilities",
};

const NAME_ASSETS: Array<[RegExp, string]> = [
  [/продукт|grocer|food|lebensmittel|courses|shopping cart/i, "groceries"],
  [/транспорт|метро|автобус|такси|transport|metro|bus|taxi|verkehr/i, "transport"],
  [/кофе|coffee|café|kaffee/i, "coffee"],
  [/кафе|ресторан|еда|обед|dining|restaurant|lunch|essen|repas/i, "dining"],
  [/жиль|аренд|дом|housing|rent|home|miete|logement/i, "housing"],
  [/жкх|коммун|utilities|electric|internet|utility|nebenkosten/i, "utilities"],
  [/здоров|врач|health|doctor|gesund|santé/i, "health"],
  [/аптек|лекар|pharmacy|medicine|apotheke|pharmacie/i, "pharmacy"],
  [/покуп|одеж|shopping|clothes|einkauf|achats/i, "shopping"],
  [/развлеч|кино|игр|entertainment|cinema|game|unterhaltung|loisir/i, "entertainment"],
  [/подпис|subscription|abo|abonnement/i, "subscriptions"],
  [/образован|учеб|education|school|bildung|éducation/i, "education"],
  [/путеше|отпуск|travel|trip|reise|voyage/i, "travel"],
  [/зарплат|доход|salary|income|gehalt|salaire/i, "salary"],
  [/подар|gift|geschenk|cadeau/i, "gifts"],
  [/накоп|сбереж|savings|saving|erspar|épargne/i, "savings"],
];

export function getCategoryAsset(icon?: string | null, name?: string | null) {
  const normalizedName = name?.trim() ?? "";
  const namedAsset = NAME_ASSETS.find(([pattern]) => pattern.test(normalizedName));
  if (namedAsset) return `/category-icons/${namedAsset[1]}.png`;
  const asset = icon ? ICON_ASSETS[icon] : undefined;
  return asset ? `/category-icons/${asset}.png` : null;
}

export function CategoryArtwork({
  icon,
  name,
  className = "h-10 w-10",
  imageClassName = "h-full w-full object-contain",
  fallback,
}: {
  icon?: string | null;
  name?: string | null;
  className?: string;
  imageClassName?: string;
  fallback?: ReactNode;
}) {
  const src = getCategoryAsset(icon, name);

  if (!src) return <>{fallback}</>;

  return (
    <span className={`relative block shrink-0 overflow-hidden ${className}`}>
      <Image
        src={src}
        alt=""
        fill
        sizes="64px"
        className={imageClassName}
        aria-hidden="true"
      />
    </span>
  );
}
