import { LucideIcon } from "lucide-react";
import { KeyboardEvent, useRef } from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
}

/** Underline tabs; scrolls sideways on narrow screens and supports arrow-key navigation. */
export function Tabs({ tabs, value, onChange, ariaLabel }: { tabs: TabItem[]; value: string; onChange: (id: string) => void; ariaLabel?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(tabs[next].id);
      refs.current[next]?.focus();
    }
  };

  return (
    <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div role="tablist" aria-label={ariaLabel} className="flex min-w-max gap-1 border-b border-border">
        {tabs.map((t, i) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              ref={(el) => (refs.current[i] = el)}
              role="tab"
              type="button"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`relative -mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3.5 text-sm font-medium transition-colors sm:min-h-10 ${
                active ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.icon && <t.icon className="h-4 w-4" aria-hidden="true" />}
              {t.label}
              {t.badge !== undefined && <span className="num rounded-full bg-primary/10 px-1.5 text-xs text-primary">{t.badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
