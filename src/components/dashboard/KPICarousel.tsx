import { Children, ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface KPICarouselProps {
  children: ReactNode;
  /** Tailwind classes applied to the desktop grid wrapper. Defaults to a 4-col grid. */
  desktopGridClassName?: string;
  /** Min card width on mobile (used as basis for snap items). */
  mobileItemClassName?: string;
  className?: string;
  /** Show paging dots on mobile. */
  showDots?: boolean;
}

/**
 * Responsive KPI container.
 * - Mobile (<md): horizontal snap-scroll carousel with optional paging dots.
 * - Desktop (md+): normal CSS grid.
 *
 * Reusable across any dashboard — just drop KPI cards (or anything else) as children.
 */
export default function KPICarousel({
  children,
  desktopGridClassName = "md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-4 lg:gap-6",
  mobileItemClassName = "basis-[78%] sm:basis-[48%] shrink-0 snap-start",
  className,
  showDots = true,
}: KPICarouselProps) {
  const items = Children.toArray(children);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const card = el.firstElementChild as HTMLElement | null;
      if (!card) return;
      const w = card.getBoundingClientRect().width + 16; // gap-4
      const idx = Math.round(el.scrollLeft / w);
      setActiveIndex(Math.min(items.length - 1, Math.max(0, idx)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [items.length]);

  return (
    <div className={cn("w-full", className)}>
      {/* Mobile: horizontal carousel */}
      <div
        ref={scrollerRef}
        className={cn(
          "md:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mr-4 pl-1 pr-4 pb-1",
        )}
      >
        {items.map((child, i) => (
          <div key={i} className={mobileItemClassName}>
            {child}
          </div>
        ))}
      </div>

      {/* Mobile: paging dots */}
      {showDots && items.length > 1 && (
        <div className="md:hidden flex items-center justify-center gap-1.5 mt-3">
          {items.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i === activeIndex ? "w-5 bg-wj-green" : "w-1.5 bg-muted-foreground/40",
              )}
            />
          ))}
        </div>
      )}

      {/* Desktop: grid */}
      <div className={cn("hidden", desktopGridClassName)}>{items}</div>
    </div>
  );
}