import Image from "next/image";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md";
  wordmarkClassName?: string;
  showMark?: boolean;
}

const LOGO_SIZES = {
  sm: { pixels: 32, className: "h-8 w-8 rounded-[0.7rem]" },
  md: { pixels: 36, className: "h-9 w-9 rounded-xl" },
} as const;

export function BrandLogo({
  className = "",
  size = "sm",
  wordmarkClassName = "",
  showMark = true,
}: BrandLogoProps) {
  const logoSize = LOGO_SIZES[size];

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {showMark && (
        <Image
          src="/icon.svg"
          width={logoSize.pixels}
          height={logoSize.pixels}
          alt=""
          unoptimized
          className={logoSize.className}
        />
      )}
      <span
        className={`text-lg font-bold tracking-[-0.035em] text-slate-950 dark:text-slate-50 ${wordmarkClassName}`}
      >
        Lumium
      </span>
    </span>
  );
}
