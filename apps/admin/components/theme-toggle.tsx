"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Switches between the light and dark themes. The icon is only chosen after
 * mount: the server cannot know the stored theme, so rendering it earlier
 * would mismatch on hydration.
 */
export function ThemeToggle({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = !mounted || resolvedTheme === "dark";
  const label = isDark ? "Light mode" : "Dark mode";
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      data-testid="btn-theme-toggle"
      aria-label={`Switch to ${label.toLowerCase()}`}
      title={`Switch to ${label.toLowerCase()}`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex items-center gap-3 rounded-md text-muted-foreground hover:text-foreground hover:bg-wash-2 transition-colors cursor-pointer",
        showLabel ? "px-3 py-2.5 text-[13px] font-medium" : "h-9 w-9 justify-center",
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {showLabel && label}
    </button>
  );
}
