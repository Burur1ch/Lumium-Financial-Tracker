"use client";

import React from "react";
import Image from "next/image";
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

export const PROFILE_AVATARS = Array.from({ length: 8 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return { key: `avatar-${number}`, src: `/avatars/avatar-${number}.png` };
});

const DEFAULT_AVATAR = {
  key: "avatar-default",
  src: "/avatars/avatar-default.png",
};

interface UserAvatarProps {
  color: string;
  iconKey: string;
  imageKey?: string | null;
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
  imageKey,
  size = "md",
  className = "",
}: UserAvatarProps) {
  const entry = AVATAR_ICONS.find((i) => i.key === iconKey) ?? AVATAR_ICONS[0];
  const Icon = entry.icon;
  const s = SIZE_MAP[size];
  const image =
    imageKey === "classic"
      ? undefined
      : PROFILE_AVATARS.find((item) => item.key === imageKey) ?? DEFAULT_AVATAR;
  return (
    <div
      className={`${s.wrapper} relative overflow-hidden rounded-full flex items-center justify-center shrink-0 ${className}`}
      style={{ backgroundColor: color }}
    >
      {image ? (
        <Image
          src={image.src}
          alt=""
          fill
          sizes="64px"
          className="object-cover"
          aria-hidden="true"
        />
      ) : (
        <Icon className={`${s.icon} text-white`} strokeWidth={2} />
      )}
    </div>
  );
}
