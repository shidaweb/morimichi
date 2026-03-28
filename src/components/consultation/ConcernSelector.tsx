"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type ConcernRow = Database["public"]["Tables"]["concerns"]["Row"];

type Props = {
  concerns: ConcernRow[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

export function ConcernSelector({ concerns, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const summary = useMemo(() => {
    if (value.length === 0) return "困りごとを選ぶ（複数可）";
    if (value.length <= 2) {
      const labels = value
        .map((id) => concerns.find((c) => c.id === id)?.label)
        .filter(Boolean);
      return labels.join("、");
    }
    return `${value.length}件を選択中`;
  }, [concerns, value]);

  const toggle = (id: string) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          nativeButton={false}
          className={cn(
            "border-input bg-background ring-offset-background inline-flex h-auto min-h-10 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm font-normal shadow-none outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          )}
          disabled={disabled || concerns.length === 0}
        >
          <span className="line-clamp-2">{summary}</span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,22rem)] p-2" align="start">
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {concerns.map((c) => (
              <label
                key={c.id}
                className="hover:bg-muted/60 flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm"
              >
                <Checkbox
                  checked={selectedSet.has(c.id)}
                  onCheckedChange={() => toggle(c.id)}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <span className={cn(c.triggers_crisis && "text-accent font-medium")}>
                  {c.label}
                  {c.triggers_crisis ? "（要配慮）" : ""}
                </span>
              </label>
            ))}
          </div>
          {concerns.length === 0 ? (
            <p className="text-muted-foreground px-2 py-2 text-xs">先にフェーズを選んでください</p>
          ) : null}
        </PopoverContent>
      </Popover>
      <Label className="text-muted-foreground sr-only">困りごとの選択</Label>
    </div>
  );
}
