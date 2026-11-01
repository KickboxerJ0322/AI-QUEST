# AI QUEST — 王の命令

王様がAI勇者に命令を出し、実時間30分以内に魔王を倒せるかを検証するWeb RPG。

## Infrastructure
- Google Cloud project: `jumpeicloud`
- Cloud Run service: `ai-quest`
- Region: `asia-northeast1`
- GitHub Actions: push to `main` triggers build and deployment
- Authentication: Workload Identity Federation (OIDC); no service-account keys in GitHub

## Initial setup
Follow [docs/cloud-setup.md](docs/cloud-setup.md) to configure Google Cloud IAM and repository Actions variables. Until setup completes, the workflow intentionally fails safely rather than deploying with credentials.

## MVP
The initial deployment serves a responsive landing page and a health-check endpoint. The 30-minute autonomous agent, Gemini, Firestore and game engine are planned and **not yet implemented**.
