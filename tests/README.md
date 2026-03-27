# QA Test Suites

## E2E
- Run all: `pnpm test:e2e`
- Headed: `pnpm test:e2e:headed`

## Integration (RLS)
- Run RLS tests: `pnpm test:integration:rls`
- Required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `SUPABASE_ANON_KEY`)
  - `TEST_CONSULTER_EMAIL`, `TEST_CONSULTER_PASSWORD`
  - `TEST_ADVISOR_EMAIL`, `TEST_ADVISOR_PASSWORD`

## Notes
- Some tests are intentionally `test.skip(...)` when required test accounts are not provided.
- `tests/performance/lighthouse.spec.ts` is a temporary Playwright smoke check; replace with Lighthouse CI thresholds for release gating.
