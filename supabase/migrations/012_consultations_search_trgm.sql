-- Task 007: 日本語を含むキーワード検索（simple tsvector ではトークン化されないため ILIKE + pg_trgm で補強）

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_consultations_title_trgm
  ON public.consultations USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_consultations_body_trgm
  ON public.consultations USING gin (body gin_trgm_ops);
