# S3トリガー実装時の循環依存エラー

## 問題概要

AWS Amplify Gen 2でS3ストレージトリガーを実装しようとした際に、CloudFormationの循環依存エラーが発生し、デプロイができない状態になっています。

## 実装したかった機能

1. **PDFアップロード時の自動処理**
   - `rawFiles`バケットにPDF/PPTXがアップロードされると、`convert-worker` Lambdaを自動実行
   - PDFを画像に変換して`images`バケットに保存

2. **画像アップロード時の自動処理**
   - `images`バケットにPNGがアップロードされると、`embed-worker` Lambdaを自動実行
   - 画像からベクトル埋め込みを生成

## 発生している問題

### エラーメッセージ
```
[CloudformationStackCircularDependencyError] The CloudFormation deployment failed due to circular dependency found between nested stacks [storage0EC3F24A, functions027F298D]
```

### 循環依存の原因
- `storage`スタック（S3バケット）が`functions`スタック（Lambdaトリガーハンドラー）を参照
- `functions`スタック（トリガーハンドラー）が`functions`スタック（convert-worker, embed-worker）を参照
- 結果として循環依存が発生

## 試行した解決策

### 1. `resourceGroupName`の指定
```typescript
export const onUploadHandler = defineFunction({
  name: 'on-upload-handler',
  entry: './handler.ts',
  resourceGroupName: 'functions', // ← 追加
  environment: {
    CONVERT_WORKER_FUNCTION_NAME: 'amplify-visionragapp-node-sa-ConvertWorkerBB08793B-EXp55WaMOZsA'
  }
});
```
→ 依然として循環依存エラーが発生

### 2. トリガーハンドラーのバックエンドからの除外
- `backend.ts`からトリガーハンドラーのimportと登録を削除
- `storage/resource.ts`からトリガー設定を削除
→ 循環依存は解決されるが、トリガー機能が失われる

## 現在のファイル構成

```
amplify/
├── backend.ts                          # メインバックエンド設定
├── storage/
│   ├── resource.ts                     # S3バケット定義
│   ├── on-upload-handler/
│   │   ├── resource.ts                 # PDFアップロードトリガー
│   │   └── handler.ts                  # トリガーハンドラー実装
│   └── on-image-upload-handler/
│       ├── resource.ts                 # 画像アップロードトリガー
│       └── handler.ts                  # トリガーハンドラー実装
└── functions/
    ├── convert-worker/                 # PDF→画像変換
    ├── embed-worker/                   # 画像→ベクトル変換
    ├── index-merger/                   # ベクトルインデックス統合
    └── search-router/                  # 検索API
```

## トリガーハンドラーの実装内容

### PDF/PPTXアップロードトリガー (`on-upload-handler`)
```typescript
import { S3Handler } from 'aws-lambda';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export const handler: S3Handler = async (event) => {
  // S3イベントを受信
  // PDF/PPTXファイルを検出
  // convert-workerを非同期で呼び出し
};
```

### 画像アップロードトリガー (`on-image-upload-handler`)
```typescript
import { S3Handler } from 'aws-lambda';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export const handler: S3Handler = async (event) => {
  // S3イベントを受信
  // PNGファイルを検出
  // embed-workerを非同期で呼び出し
};
```

## 求めている解決策

以下のいずれかの方法でS3トリガーを実装したい：

1. **Amplify Gen 2のネイティブ機能を使用**
   - `defineStorage`の`triggers`オプションを正しく設定
   - 循環依存を回避する適切な構成

2. **代替実装方法**
   - AWS CDKの直接使用
   - 別のスタック構成
   - EventBridgeを使った間接的なトリガー

3. **手動設定後の管理方法**
   - AWS CLIでトリガーを設定後、Amplifyで管理を継続する方法

## 現在の状態

- S3バケットとLambda関数は正常にデプロイ済み
- ファイルアップロード機能は動作中
- トリガーのみが未実装
- 手動でLambda関数を呼び出せば処理は正常動作

## 環境情報

- AWS Amplify Gen 2 (TypeScript)
- @aws-amplify/backend: 1.16.1
- Node.js: 20.x
- リージョン: ap-northeast-1

## 参考ドキュメント

- [Amplify Gen 2 Storage Triggers](https://docs.amplify.aws/react/build-a-backend/storage/triggers/)
- [CloudFormation Circular Dependency Resolution](https://github.com/aws-amplify/amplify-backend/issues)