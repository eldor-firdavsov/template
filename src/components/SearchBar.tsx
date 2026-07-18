import { useState } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search services..." }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-xl bg-surface transition-all ${
        focused ? "ring-2 ring-accent/30" : ""
      }`}
    >
      <svg className="w-5 h-5 text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="bg-transparent flex-1 text-sm outline-none placeholder:text-muted/50"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="p-0.5 rounded-full hover:bg-primary/10 transition-colors"
        >
          <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
