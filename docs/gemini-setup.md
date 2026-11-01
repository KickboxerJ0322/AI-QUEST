# STEP 2 — Gemini勇者の有効化

**重要:** AI QUESTは公開Cloud Runサービスです。Gemini APIキーをWebページ、GitHub、ブラウザlocalStorageに置かないでください。

## 構成
- ブラウザはゲーム状態とメモ帳を保持し、観測JSONをサーバーへ送信
- Cloud Runサーバーはアクセス・トークンを検証してGemini APIを呼び出す
- Geminiは行動1件・理由・任意のメモ1件をJSONで返す
- ブラウザは行動を実行して結果を表示。次の観測を送る
- 30分または120回の判断で終了。**ブラウザを閉じると止まります**
- サーバーには簡易のインスタンス内レート制限あり。ただしCloud Runのスケールアウトや再起動をまたぐ厳格な課金上限ではありません。

## APIキーをSecret Managerに登録

Cloud Shellで実行（APIキーをシェル履歴に直接書かない）。

```bash
gcloud config set project jumpeicloud
gcloud services enable secretmanager.googleapis.com
read -rsp "Gemini API key: " GEMINI_KEY; echo
printf '%s' "$GEMINI_KEY" | gcloud secrets create ai-quest-gemini-key --data-file=- --replication-policy=automatic
unset GEMINI_KEY
```

すでにSecretがある場合は `gcloud secrets versions add ai-quest-gemini-key --data-file=-` を利用します。

同様に、**24文字以上のランダムなアクセス・トークン**を作成して登録します。

```bash
TOKEN="$(openssl rand -hex 24)"
printf '%s' "$TOKEN" | gcloud secrets create ai-quest-access-token --data-file=- --replication-policy=automatic
echo "Access token (save privately; do not commit): $TOKEN"
unset TOKEN
```

Cloud Runの実行サービスアカウントを確認します。

```bash
gcloud run services describe ai-quest --region=asia-northeast1 --format='value(spec.template.spec.serviceAccountName)'
```

空欄の場合、Compute Engineのデフォルトサービスアカウント（`331230486346-compute@developer.gserviceaccount.com`）が使われる場合があります。実際のサービス設定を確認してから、**対象の2つのSecretに限定して**その実行サービスアカウントへ `roles/secretmanager.secretAccessor` を付与してください。

```bash
RUNTIME_SA="331230486346-compute@developer.gserviceaccount.com"
for NAME in ai-quest-gemini-key ai-quest-access-token; do
  gcloud secrets add-iam-policy-binding "$NAME" \
    --member="serviceAccount:$RUNTIME_SA" \
    --role="roles/secretmanager.secretAccessor"
done
```

## Cloud RunにSecretを設定する

```bash
gcloud run services update ai-quest --region=asia-northeast1 \
  --update-secrets=GEMINI_API_KEY=ai-quest-gemini-key:latest,AI_QUEST_ACCESS_TOKEN=ai-quest-access-token:latest \
  --update-env-vars=GEMINI_MODEL=gemini-3-flash-preview
```

**注意:** GitHub Actionsの自動デプロイは `--source=.` を使用します。今後のデプロイでも環境変数とSecret参照が保持されるか確認してください。

## 操作
1. AI QUESTを開き、王様の命令を入力
2. アクセス・トークンを入力（ブラウザに保存しません）
3. 「Gemini勇者を開始」を押す
4. AIの行動ログ、メモ帳、APIトークン数を観察

## 安全性と未実装事項
- 本段階ではサーバーがゲーム状態を検証していません。ユーザーが観測JSONを偽造できるため、厳密なAI性能比較にはまだ使えません。
- Cloud Runのメモリ内制限はインスタンスごとであり、確実な課金上限ではありません。利用者を限定し、Google Cloudのクォータや予算アラートも設定してください。
- SecretはAPIキーの保護には役立ちますが、入力するアクセス・トークンを知っている人はAPIを呼べます。将来はログイン認証とFirestoreのサーバー側実行管理に置き換えます。
- Geminiモデル名は実際に利用可能なモデルに変更できます。初期値は `gemini-3-flash-preview` です。
