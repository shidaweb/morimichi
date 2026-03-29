"use client";

import { useState } from "react";

import { ContactRequestModal } from "@/components/pro/contact-request-modal";
import { Button } from "@/components/ui/button";
import type { ProSpecialtyBadge } from "@/lib/pro/pro-specialty-badge";

type Props = {
  targetUserId: string;
  targetNickname: string;
  targetAvatarUrl: string | null;
  targetSpecialty: ProSpecialtyBadge | null;
  showContact: boolean;
};

export function ArticleDetailActions({
  targetUserId,
  targetNickname,
  targetAvatarUrl,
  targetSpecialty,
  showContact,
}: Props) {
  const [open, setOpen] = useState(false);

  if (!showContact) return null;

  return (
    <>
      <Button
        type="button"
        className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600"
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
        targetSpecialty={targetSpecialty}
        isCertifiedPro
      />
    </>
  );
}
