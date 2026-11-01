# STEP 3 — 30分クラウド自律攻略

## 実装
- ブラウザは王様の命令を1回送る。サーバーがFirestoreに冒険セッションを作成
- Gemini 3 Flashに最大12アクションをまとめて提案させる
- サーバーが1行動ずつゲームエンジンで検証・実行。戦闘・重要地点・障害物では再観測して再計画
- Firestoreに現在状態、直近の行動履歴、AIメモ、API呼出数、実時間の締切を保存
- スマホでページを開き、アクセス・トークンを入力して進捗を閲覧
- 実時間30分、最大150 Gemini呼出、最大1400行動、同時1冒険、1日10冒険の安全制限

## 初回設定（Cloud Shell）

**1. Firestore APIを有効化**
```bash
gcloud config set project jumpeicloud
gcloud services enable firestore.googleapis.com
gcloud firestore databases list --project=jumpeicloud
```

**(default) データベースが無い場合のみ**、Google CloudコンソールのFirestoreからNativeモードの `(default)` を作成してください。既存の `codeaudit` などの名前付きDBとは別です。データベースを新規作成する場合はリージョンと費用を確認してください。

**2. Cloud Run実行サービスアカウントを確認**
```bash
gcloud run services describe ai-quest --region=asia-northeast1 --format='value(spec.template.spec.serviceAccountName)'
```

値が空の場合は通常Compute EngineデフォルトSAが使用されます。実際に使用されているSAをGoogle CloudコンソールのCloud Runサービス設定でも確認してください。

**3. 実行SAへFirestoreアクセス権を付与**

以下の `RUNTIME_SA` は、**実際の実行SAに書き換えて**ください。

```bash
RUNTIME_SA="331230486346-compute@developer.gserviceaccount.com"
gcloud projects add-iam-policy-binding jumpeicloud \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/datastore.user" \
  --condition=None
```

以前のCloud Shellで条件付きIAMの選択肢が表示されたため、上記は `--condition=None` を明示しています。

**4. GitHub Actionsで再デプロイ**

ワークフローはCloud Runを `--min-instances=1 --max-instances=1 --no-cpu-throttling` に更新します。バックグラウンドで30分動かすための設定です。

**費用注意：** 最小インスタンス1、CPU常時割当は待機中も課金されます。予算アラート、Geminiクォータ、Cloud Runの費用を監視してください。試験終了後は `gcloud run services update ai-quest --region=asia-northeast1 --min-instances=0 --cpu-throttling` で待機コストを抑えられますが、その状態ではブラウザを閉じた後の自律攻略を保証できません。

## 操作
1. 王様の命令とアクセス・トークンを入力して「30分の自律攻略を開始」
2. ブラウザを閉じてもCloud Run上の冒険が継続
3. 同じブラウザのタブを再読み込みし、トークンを再入力して「進行中の冒険を再表示」
4. 別端末からは「冒険IDをコピー」で取得したIDをスマホの「冒険ID」欄に貼り付け、同じアクセス・トークンを入力して「進行中の冒険を再表示」

## 制約
- Cloud Runサービス上の非同期ループによる**実験実装**です。Firestoreへ進捗を保存し、インスタンス起動時に進行中の冒険を再開しますが、Cloud Runのリビジョン切替やクラッシュ直後の再開タイミングは保証できません。堅牢な本番運用ではCloud Run Jobs + Cloud Tasks / Scheduler等へ移行してください。
- Geminiへの入力は `observe(state)` と直近の移動履歴・メモです。内部のWORLD全体は送信しません。
- サーバーのメモリでなくFirestoreに状態を保存しますが、現在の認証は共有トークン方式です。公開サービスではユーザー別認証と実行単位の権限制御が必要です。
- Cloud Runの常時CPU設定だけでは厳密な可用性保証にはなりません。
- 30分間の通し攻略とCloud Run実行環境の権限・課金は未検証です。
