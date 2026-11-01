# GitHub → Cloud Run 自動デプロイ初期設定

Google Cloud Shell (project owner権限が必要) で実行してください。コマンドは `jumpeicloud`、GitHub `KickboxerJ0322/AI-QUEST` 専用です。

```bash
gcloud config set project jumpeicloud
PROJECT_NUMBER="$(gcloud projects describe jumpeicloud --format='value(projectNumber)')"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

# Create deployer service account and least-privilege deployment permissions.
gcloud iam service-accounts create ai-quest-deployer --display-name="AI QUEST GitHub Deployer"
SA="ai-quest-deployer@jumpeicloud.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding jumpeicloud --member="serviceAccount:$SA" --role="roles/run.admin"
gcloud projects add-iam-policy-binding jumpeicloud --member="serviceAccount:$SA" --role="roles/cloudbuild.builds.editor"
gcloud projects add-iam-policy-binding jumpeicloud --member="serviceAccount:$SA" --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding jumpeicloud --member="serviceAccount:$SA" --role="roles/serviceusage.serviceUsageConsumer"
# Source deployment uploads a source archive to a Cloud Storage bucket.
# Prefer pre-creating a dedicated staging bucket and granting bucket-scoped access.
# For initial gcloud run deploy --source=. the deployer may need project-level storage.buckets.create.
# Grant roles/storage.admin only if the source staging bucket does not exist; review and narrow afterward.
# Cloud Run service identity defaults to Compute Engine default service account for first deployment.
RUNTIME_SA="$(gcloud projects describe jumpeicloud --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --member="serviceAccount:$SA" --role="roles/iam.serviceAccountUser"

# Workload Identity Federation for GitHub Actions.
gcloud iam workload-identity-pools create ai-quest-github --location=global --display-name="AI QUEST GitHub"
gcloud iam workload-identity-pools providers create-oidc github --location=global --workload-identity-pool=ai-quest-github \
  --display-name="GitHub Actions" --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == 'KickboxerJ0322/AI-QUEST'"
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/ai-quest-github/attribute.repository/KickboxerJ0322/AI-QUEST"

echo "GCP_WIF_PROVIDER=projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/ai-quest-github/providers/github"
echo "GCP_SERVICE_ACCOUNT=$SA"
```

GitHub repository → Settings → Secrets and variables → Actions → **Variables** で、表示された2つの値を登録します。

- `GCP_WIF_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

設定後、GitHub → Actions → Deploy AI QUEST to Cloud Run → Run workflow を実行してください。以降、`main` にpushすると自動デプロイされます。

**注意：** これは初回セットアップ用です。既存の同名IAMリソースがある場合は作成コマンドを繰り返さず、存在を確認してください。Cloud Buildの利用するビルドサービスアカウントには別途Artifact Registry書込権限等が必要になる環境があります。その場合はログを確認し必要最小限の権限を付けてください。初回公開は認証なしですが、AI攻略・課金APIを公開する前にはログイン・利用制限・課金上限を追加してください。
