"use client";

import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type PhaseRow = Database["public"]["Tables"]["phases"]["Row"];

type Props = {
  phases: PhaseRow[];
  value: string | null;
  onChange: (phaseId: string) => void;
  disabled?: boolean;
};

export function PhaseSelector({ phases, value, onChange, disabled }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Step 1 — いちばん近いフェーズを選ぶ</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {phases.map((p) => {
          const selected = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p.id)}
              className={cn(
                "border-border hover:border-primary/50 flex flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left text-sm transition-colors",
                selected && "border-primary ring-primary/30 ring-2",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              <span className="text-lg leading-none" aria-hidden>
                {p.icon}
              </span>
              <span className="font-medium leading-tight">{p.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
