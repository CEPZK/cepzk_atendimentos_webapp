# ops/

## Enabling CI

This workflow is staged here because a GitHub App cannot push files into
`.github/workflows/` unless it is granted the `workflows` permission — the push is
rejected with `refusing to allow a GitHub App to create or update workflow`.

From an account that can (or after granting that permission), run:

```bash
git mv ops/ci.yml .github/workflows/ci.yml && git push
```

Everything else in `ci.yml` is repo-agnostic: lint → typecheck → build, with the
build fed placeholder env vars, plus a `contract-drift` job that stays off until
the repo settings define `SUPABASE_DRIFT_CHECK=true`, `SUPABASE_PROJECT_REF`, and
the `SUPABASE_ACCESS_TOKEN` secret.
