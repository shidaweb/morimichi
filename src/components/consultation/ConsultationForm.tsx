"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CrisisBanner } from "@/components/common/CrisisBanner";
import { ConcernSelector } from "@/components/consultation/ConcernSelector";
import { PhaseSelector } from "@/components/consultation/PhaseSelector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSupabaseBrowser } from "@/hooks/useSupabaseBrowser";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type PhaseRow = Database["public"]["Tables"]["phases"]["Row"];
type ConcernRow = Database["public"]["Tables"]["concerns"]["Row"];

type Props = {
  phases: PhaseRow[];
};

type Step = 1 | 2 | 3 | 4 | "preview";

export function ConsultationForm({ phases }: Props) {
  const router = useRouter();
  const supabase = useSupabaseBrowser();
  const [step, setStep] = useState<Step>(1);
  const [phaseId, setPhaseId] = useState<string | null>(null);
  const [concernIds, setConcernIds] = useState<string[]>([]);
  const [concerns, setConcerns] = useState<ConcernRow[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loadingConcerns, setLoadingConcerns] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPhase = useMemo(
    () => phases.find((p) => p.id === phaseId) ?? null,
    [phases, phaseId],
  );

  const loadConcerns = useCallback(
    async (pid: string) => {
      if (!supabase) return;
      setLoadingConcerns(true);
      const { data, error: err } = await supabase
        .from("concerns")
        .select("*")
        .eq("phase_id", pid)
        .order("sort_order", { ascending: true });
      setLoadingConcerns(false);
      if (err) {
        setConcerns([]);
        return;
      }
      setConcerns((data ?? []) as ConcernRow[]);
    },
    [supabase],
  );

  useEffect(() => {
    if (!phaseId || !supabase) return;
    // loadConcerns は非同期で Supabase から取得し、await 後に setState する
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 上記の非同期データ取得パターン
    void loadConcerns(phaseId);
  }, [phaseId, supabase, loadConcerns]);

  const hasCrisisConcern = useMemo(() => {
    return concernIds.some((id) => {
      const c = concerns.find((x) => x.id === id);
      return Boolean(c?.triggers_crisis);
    });
  }, [concernIds, concerns]);

  function goNext() {
    setError(null);
    if (step === 1) {
      if (!phaseId) {
        setError("フェーズを選んでください");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (concernIds.length < 1) {
        setError("困りごとを1つ以上選んでください");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      const t = title.trim();
      if (!t || t.length > 100) {
        setError("タイトルを1〜100文字で入力してください");
        return;
      }
      setStep(4);
    } else if (step === 4) {
      const b = body.trim();
      if (!b || b.length > 10000) {
        setError("本文を1〜10,000文字で入力してください");
        return;
      }
      setStep("preview");
    }
  }

  function goBack() {
    setError(null);
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) setStep(3);
    else if (step === "preview") setStep(4);
  }

  async function onSubmit() {
    if (!phaseId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phaseId,
          concernIds,
          title: title.trim(),
          body: body.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        message?: string;
      };
      if (!res.ok) {
        if (res.status === 429) {
          setError("本日の投稿上限に達しました。明日また試してください。");
        } else if (res.status === 403) {
          setError(
            json.message ??
              "投稿できません。相談者としての登録が必要な場合があります。",
          );
        } else {
          setError(json.error ?? "送信に失敗しました");
        }
        setSubmitting(false);
        return;
      }
      if (json.id) {
        router.push(`/consultations/${json.id}`);
        router.refresh();
        return;
      }
      setError("送信に失敗しました");
    } catch {
      setError("通信エラーが発生しました");
    }
    setSubmitting(false);
  }

  const busy = submitting || !supabase || loadingConcerns;

  return (
    <div className="space-y-8">
      {hasCrisisConcern ? <CrisisBanner /> : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>確認してください</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === 1 ? (
        <PhaseSelector
          phases={phases}
          value={phaseId}
          onChange={(id) => {
            setPhaseId(id);
            setConcernIds([]);
            setConcerns([]);
          }}
          disabled={busy}
        />
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <ConcernSelector
            concerns={concerns}
            value={concernIds}
            onChange={setConcernIds}
            disabled={busy}
          />
          {loadingConcerns ? (
            <p className="text-muted-foreground text-sm">読み込み中…</p>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">Step 3 — タイトル（100文字以内）</p>
          <Label htmlFor="ct-title" className="sr-only">
            タイトル
          </Label>
          <Input
            id="ct-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            disabled={busy}
            placeholder="いまの状況がひと目でわかる一行"
          />
          <p className="text-muted-foreground text-right text-xs">
            {title.length}/100
          </p>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <p className="text-sm font-medium">Step 4 — 本文（10,000文字以内）</p>
          <Alert>
            <AlertTitle>投稿前のお願い</AlertTitle>
            <AlertDescription className="space-y-2 text-sm leading-relaxed">
              <p>
                ここで得られるのは個人の経験や視点であり、法的・税務・金融の助言ではありません。最終判断はご自身や専門家と相談してください。
              </p>
              <p>
                個人が特定される情報（本名・連絡先・会社名の特定につながる記述など）は避けてください。
              </p>
            </AlertDescription>
          </Alert>
          <Label htmlFor="ct-body" className="sr-only">
            本文
          </Label>
          <Textarea
            id="ct-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={10000}
            disabled={busy}
            rows={12}
            placeholder="状況や気持ちを、無理のない範囲で書いてみてください。"
          />
          <p className="text-muted-foreground text-right text-xs">
            {body.length}/10000
          </p>
        </div>
      ) : null}

      {step === "preview" ? (
        <div className="border-border space-y-4 rounded-xl border bg-card/40 p-5">
          <p className="text-sm font-medium">プレビュー</p>
          {selectedPhase ? (
            <p className="text-muted-foreground text-sm">
              <span className="mr-1">{selectedPhase.icon}</span>
              {selectedPhase.name}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            困りごと:{" "}
            {concernIds
              .map((id) => concerns.find((c) => c.id === id)?.label)
              .filter(Boolean)
              .join("、")}
          </p>
          <h2 className="text-lg font-semibold">{title.trim() || "（無題）"}</h2>
          <div className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
            {body.trim()}
          </div>
          {hasCrisisConcern ? <CrisisBanner /> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step !== 1 ? (
          <Button type="button" variant="outline" onClick={goBack} disabled={busy}>
            戻る
          </Button>
        ) : null}
        {step !== "preview" ? (
          <Button type="button" onClick={goNext} disabled={busy}>
            次へ
          </Button>
        ) : (
          <Button type="button" onClick={() => void onSubmit()} disabled={busy}>
            {submitting ? "送信中…" : "この内容で投稿する"}
          </Button>
        )}
        <Link href="/consultations" className={cn(buttonVariants({ variant: "ghost" }))}>
          一覧へ
        </Link>
      </div>
    </div>
  );
}
