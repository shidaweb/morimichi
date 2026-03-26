"use client";

import { useEffect, useRef } from "react";

type Props = {
  consultationId: string;
  onRecorded?: (counted: boolean) => void;
};

export function ConsultationViewRecorder({ consultationId, onRecorded }: Props) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const key = `saisei:view:${consultationId}`;
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) {
        return;
      }
    } catch {
      // sessionStorage unavailable
    }

    void (async () => {
      try {
        const res = await fetch(`/api/consultations/${consultationId}/view`, {
          method: "POST",
          credentials: "include",
        });
        const j = (await res.json().catch(() => ({}))) as {
          counted?: boolean;
        };
        try {
          sessionStorage.setItem(key, "1");
        } catch {
          // ignore
        }
        onRecorded?.(j.counted === true);
      } catch {
        onRecorded?.(false);
      }
    })();
  }, [consultationId, onRecorded]);

  return null;
}
