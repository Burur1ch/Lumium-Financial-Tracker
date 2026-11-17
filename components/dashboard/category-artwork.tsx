"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import {
  Apple,
  Armchair,
  ArrowDownLeft,
  ArrowUpRight,
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  BusFront,
  Car,
  Coffee,
  CreditCard,
  Croissant,
  CupSoda,
  Dumbbell,
  FilePenLine,
  Fish,
  Footprints,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  Headphones,
  Heart,
  Home,
  Landmark,
  Milk,
  Music,
  PawPrint,
  Phone,
  PiggyBank,
  Pizza,
  Plane,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  SprayCan,
  Stethoscope,
  Tag,
  TrainFront,
  Tv,
  Utensils,
  Wallet,
  Wifi,
  Wine,
  Wrench,
  Zap,
  Pill,
  type LucideIcon,
} from "lucide-react";
import { resolveCategoryIcon } from "@/utils/category-icons";

const SYMBOLS: Record<string, LucideIcon> = {
  shoppingCart: ShoppingCart,
  shoppingBag: ShoppingBag,
  bus: BusFront,
  home: Home,
  zap: Zap,
  stethoscope: Stethoscope,
  gamepad: Gamepad2,
  book: BookOpen,
  graduationCap: GraduationCap,
  creditCard: CreditCard,
  plane: Plane,
  gift: Gift,
  banknote: Banknote,
  briefcase: Briefcase,
  dumbbell: Dumbbell,
  shield: ShieldCheck,
  baby: Baby,
  pawPrint: PawPrint,
  sparkles: Sparkles,
  coffee: Coffee,
  pill: Pill,
  wallet: Wallet,
  piggyBank: PiggyBank,
  handCoins: HandCoins,
  landmark: Landmark,
  train: TrainFront,
  car: Car,
  fuel: Fuel,
  heart: Heart,
  tag: Tag,
  utensils: Utensils,
  pizza: Pizza,
  wine: Wine,
  wifi: Wifi,
  phone: Phone,
  wrench: Wrench,
  music: Music,
  tv: Tv,
  milk: Milk,
  fish: Fish,
  apple: Apple,
  bread: Croissant,
  cup: CupSoda,
  spray: SprayCan,
  armchair: Armchair,
  shirt: Shirt,
  shoe: Footprints,
  headphones: Headphones,
  receipt: ReceiptText,
  qrCode: QrCode,
  manual: FilePenLine,
  expense: ArrowUpRight,
  income: ArrowDownLeft,
};

export function getCategoryAsset(
  icon?: string | null,
  name?: string | null,
  systemKey?: string | null,
) {
  const definition = resolveCategoryIcon(icon, name, systemKey);
  return definition?.asset ? `/category-icons/${definition.asset}.png` : null;
}

export function CategoryArtwork({
  icon,
  name,
  systemKey,
  color,
  className = "h-10 w-10",
  imageClassName = "h-full w-full object-contain",
  fallback,
}: {
  icon?: string | null;
  name?: string | null;
  systemKey?: string | null;
  color?: string;
  className?: string;
  imageClassName?: string;
  fallback?: ReactNode;
}) {
  const definition = resolveCategoryIcon(icon, name, systemKey);
  if (!definition) return <>{fallback}</>;
  const src = definition.asset
    ? `/category-icons/${definition.asset}.png`
    : null;
  const Symbol = SYMBOLS[definition.key] ?? Tag;

  return (
    <span
      aria-hidden="true"
      data-category-icon={definition.key}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden ${src ? "" : "bg-slate-100 dark:bg-slate-800"} ${className}`}
      style={{ color: color ?? definition.color }}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="64px"
          className={imageClassName}
          aria-hidden="true"
        />
      ) : (
        <Symbol className="h-[58%] w-[58%]" strokeWidth={1.8} />
      )}
    </span>
  );
}
