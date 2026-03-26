"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { UserRole } from "@/types/database";

const options: { value: Exclude<UserRole, "moderator" | "admin">; label: string; hint: string }[] =
  [
    {
      value: "consulter",
      label: "相談したい",
      hint: "経営の悩みを匿名で投稿し、経験者の声を読みます",
    },
    {
      value: "advisor",
      label: "回答したい",
      hint: "自分の経験や気づきを、個人の見解として共有します",
    },
    {
      value: "both",
      label: "両方",
      hint: "相談もしたいし、誰かの投稿に寄り添いたい",
    },
  ];

type Props = {
  value: Exclude<UserRole, "moderator" | "admin">;
  onChange: (v: Exclude<UserRole, "moderator" | "admin">) => void;
  disabled?: boolean;
};

export function RoleSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-medium text-foreground">参加の形</Label>
      <RadioGroup
        value={value}
        onValueChange={(v) =>
          onChange(v as Exclude<UserRole, "moderator" | "admin">)
        }
        className="grid gap-3"
        disabled={disabled}
      >
        {options.map((opt) => (
          <label
            key={opt.value}
            className="border-border hover:border-primary/40 flex cursor-pointer gap-3 rounded-xl border bg-card p-4 transition-colors has-[[data-state=checked]]:border-primary"
          >
            <RadioGroupItem value={opt.value} id={`role-${opt.value}`} className="mt-1" />
            <div className="space-y-1">
              <span className="font-medium">{opt.label}</span>
              <p className="text-muted-foreground text-sm leading-relaxed">{opt.hint}</p>
            </div>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
