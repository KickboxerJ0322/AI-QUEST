# Security hardening after first deployment

## Current state
The Cloud Run service is publicly reachable, but only static RPG files and a health endpoint are served. No Gemini key or paid AI API is used.

## Reduce deployment service account permissions
The temporary project-wide `roles/storage.admin` grant for `ai-quest-deployer@jumpeicloud.iam.gserviceaccount.com` is overbroad and must not remain permanent.

**Do not remove it blindly** while the workflow uses `gcloud run deploy --source=.`: that command may create a new source staging bucket on every run.

Recommended migration:
1. Use a fixed Artifact Registry Docker repository for AI QUEST, rather than `--source=.`.
2. Build the image in Cloud Build with an explicitly chosen build service account; scope that account's permissions to the AI QUEST image repository and build logs/staging bucket.
3. Grant the GitHub deployer `roles/run.admin` (prefer service-level scope after creation), `roles/artifactregistry.reader` or required image access, and `roles/iam.serviceAccountUser` on the dedicated AI QUEST runtime service account.
4. Change GitHub Actions to deploy with `--image=...`, verify at least one successful deployment.
5. **Only then**, revoke the temporary project-wide storage role:

```bash
gcloud projects remove-iam-policy-binding jumpeicloud \
  --member="serviceAccount:ai-quest-deployer@jumpeicloud.iam.gserviceaccount.com" \
  --role="roles/storage.admin" \
  --condition=None
```

Check the policy before and after. Do not modify roles of unrelated BusRoute or CodeAudit accounts.

## Before adding Gemini
- Require sign-in for mission creation and all paid API endpoints.
- Store the Gemini key in Secret Manager; never in JS, GitHub, logs, or localStorage.
- Enforce server-side quotas, one mission per user, concurrency limits, hard 30-minute deadline, token and cost budgets.
- Use dedicated runtime and worker service accounts with minimal Firestore permissions.
- Never trust client-side game state as the source of truth for AI missions.
- Enable audit logging and set Google Cloud budget alerts (alerts do not hard-stop spending).
