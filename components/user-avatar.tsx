"use client";

import React from "react";
import {
  User,
  Star,
  Zap,
  Heart,
  Coffee,
  Music,
  Flame,
  Smile,
  Globe,
  Rocket,
  Crown,
  Shield,
  Cat,
  Dog,
  Leaf,
  Sun,
  Moon,
  Gem,
} from "lucide-react";

export const AVATAR_COLORS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#64748B",
];

export const AVATAR_ICONS: { key: string; icon: React.ElementType }[] = [
  { key: "User", icon: User },
  { key: "Star", icon: Star },
  { key: "Zap", icon: Zap },
  { key: "Heart", icon: Heart },
  { key: "Coffee", icon: Coffee },
  { key: "Music", icon: Music },
  { key: "Flame", icon: Flame },
  { key: "Smile", icon: Smile },
  { key: "Globe", icon: Globe },
  { key: "Rocket", icon: Rocket },
  { key: "Crown", icon: Crown },
  { key: "Shield", icon: Shield },
  { key: "Cat", icon: Cat },
  { key: "Dog", icon: Dog },
  { key: "Leaf", icon: Leaf },
  { key: "Sun", icon: Sun },
  { key: "Moon", icon: Moon },
  { key: "Gem", icon: Gem },
];

interface UserAvatarProps {
  color: string;
  iconKey: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { wrapper: "w-9 h-9", icon: "w-4 h-4" },
  md: { wrapper: "w-12 h-12", icon: "w-5 h-5" },
  lg: { wrapper: "w-16 h-16", icon: "w-7 h-7" },
};

export function UserAvatar({
  color,
  iconKey,
  size = "md",
  className = "",
}: UserAvatarProps) {
  const entry = AVATAR_ICONS.find((i) => i.key === iconKey) ?? AVATAR_ICONS[0];
  const Icon = entry.icon;
  const s = SIZE_MAP[size];
  return (
    <div
      className={`${s.wrapper} rounded-full flex items-center justify-center shrink-0 ${className}`}
      style={{ backgroundColor: color }}
    >
      <Icon className={`${s.icon} text-white`} strokeWidth={2} />
    </div>
  );
}
