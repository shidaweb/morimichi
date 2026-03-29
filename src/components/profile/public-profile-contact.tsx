"use client";

import { useState } from "react";

import { ContactRequestModal } from "@/components/pro/contact-request-modal";
import { Button } from "@/components/ui/button";
import type { PublicProSpecialty } from "@/lib/profile/public-profile";

type Props = {
  targetUserId: string;
  targetNickname: string;
  targetAvatarUrl: string | null;
  proSpecialty: PublicProSpecialty | null;
  isCertifiedPro: boolean;
  show: boolean;
};

export function PublicProfileContact({
  targetUserId,
  targetNickname,
  targetAvatarUrl,
  proSpecialty,
  isCertifiedPro,
  show,
}: Props) {
  const [open, setOpen] = useState(false);
  if (!show) return null;
  return (
    <section className="border-border space-y-3 rounded-xl border bg-card/40 p-5">
      <h2 className="text-sm font-semibold tracking-tight">運営を通じて相談する</h2>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {isCertifiedPro
          ? "この公認再生プロに、運営経由で相談リクエストを送れます。"
          : "この回答者に、運営経由で相談リクエストを送れます。"}
      </p>
      <Button
        type="button"
        className={
          isCertifiedPro
            ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600"
            : undefined
        }
        onClick={() => setOpen(true)}
      >
        運営を通じてこの人に相談する
      </Button>
      <ContactRequestModal
        open={open}
        onClose={() => setOpen(false)}
        targetUserId={targetUserId}
        targetNickname={targetNickname}
        targetAvatarUrl={targetAvatarUrl}
        targetSpecialty={proSpecialty}
        isCertifiedPro={isCertifiedPro}
      />
    </section>
  );
}
