import { useState } from "react";

interface AddOn {
  id: string;
  name: string;
  price: number;
  duration_extra_minutes: number;
  description: string | null;
}

interface Props {
  addOns: AddOn[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export function AddOnSelector({ addOns, selectedIds, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (addOns.length === 0) return null;

  const visible = expanded ? addOns : addOns.slice(0, 2);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted">
        Add-ons
      </h3>
      <div className="space-y-2">
        {visible.map((addon) => {
          const selected = selectedIds.includes(addon.id);
          return (
            <button
              key={addon.id}
              onClick={() => onToggle(addon.id)}
              className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border-2 ${
                selected
                  ? "border-accent bg-accent/10"
                  : "border-transparent bg-surface hover:bg-accent/5"
              }`}
            >
              <div className="text-left">
                <div className="font-medium text-sm">{addon.name}</div>
                {addon.description && (
                  <div className="text-xs text-muted">{addon.description}</div>
                )}
                <div className="text-xs text-muted mt-0.5">
                  +{addon.duration_extra_minutes} min
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-accent">+${addon.price}</span>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selected
                      ? "border-accent bg-accent"
                      : "border-muted/30"
                  }`}
                >
                  {selected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {addOns.length > 2 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-accent font-medium"
        >
          {expanded ? "Show less" : `Show all ${addOns.length} add-ons`}
        </button>
      )}
    </div>
  );
}
