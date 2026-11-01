# AI QUEST — 王の命令

Google Cloud Runで公開するオリジナル2D RPG。王様（ユーザー）が与える命令により、Gemini勇者が実時間30分以内に魔王を倒せるかを検証することが最終目標です。

## 実装済み：STEP 1
- 25×24のフィールド、探索済みマスだけを表示するマップ
- 王城、2つの町、洞窟、魔王城
- 手動移動、ランダム戦闘、経験値・レベルアップ、回復、装備・買い物、鍵、魔王討伐
- スマホ対応、ゲームのローカル保存、JSON書き出し
- AI向け観測JSONのプレビュー（隠しマップ情報は渡さない）
- GitHub Actionsでテスト後にCloud Runへ自動デプロイ

**未実装：** Gemini自律操作、王様の命令入力、冒険メモ帳の編集、30分タイマー、Cloud Run Jobs、Firestore、実験結果比較。

## ローカル実行
Node.js 22以降を使用。
```bash
npm test
npm start
```
http://localhost:8080

## Google Cloud
- project: `jumpeicloud`
- service: `ai-quest`
- region: `asia-northeast1`
- deployment: push to `main` → GitHub Actions → Cloud Run
- credential: GitHub OIDC + Workload Identity Federation

## セキュリティ
- APIキーをリポジトリに置かない。現段階ではGemini APIを呼ばない
- HTTPは静的ファイルのGET/HEADとhealthzのみ。任意ファイル読取・サーバーへの状態変更APIなし
- CSP / nosniff / frame-ancestors / Permissions-Policy 等のヘッダー
- デモゲーム状態はブラウザのlocalStorageに保存。機密情報を入力しない
- GitHubリポジトリは公開。公開Cloud Runに課金APIを追加する前に認証・レート制限・予算上限が必須
- **重要：** 初回デプロイ用に付与した `roles/storage.admin` はプロジェクト全体に効く。権限縮小の手順は [docs/security-hardening.md](docs/security-hardening.md) を参照

詳細な初期設定は [docs/cloud-setup.md](docs/cloud-setup.md)。
