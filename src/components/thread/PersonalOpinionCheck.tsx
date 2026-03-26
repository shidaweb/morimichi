"use client";

import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  id?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
};

export function PersonalOpinionCheck({
  id = "personal-opinion-ack",
  checked,
  onCheckedChange,
  disabled,
}: Props) {
  return (
    <label
      htmlFor={id}
      className="border-border bg-muted/40 flex cursor-pointer gap-3 rounded-lg border p-3 text-sm leading-relaxed"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <span>
        <span className="font-medium">個人的な経験・見解としてお伝えします</span>
        <span className="text-muted-foreground mt-1 block text-xs">
          法的・税務・金融などの助言ではなく、あくまで自分の体験や気づきであることを確認します。
        </span>
      </span>
    </label>
  );
}
