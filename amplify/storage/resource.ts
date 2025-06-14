import { defineStorage, defineFunction } from '@aws-amplify/backend';
import { Function, Code, Runtime, Handler } from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Duration } from 'aws-cdk-lib';

// 画像変換ワーカー（同じresourceGroupに配置）
export const convertWorker = defineFunction((scope) => {
  const ecrRepo = Repository.fromRepositoryName(
    scope, 
    'ConvertWorkerRepo', 
    'convert-worker'
  );

  return new Function(scope, 'ConvertWorkerV10', {
    code: Code.fromEcrImage(ecrRepo, {
      tagOrDigest: 'latest'
    }),
    handler: Handler.FROM_IMAGE,
    runtime: Runtime.FROM_IMAGE,
    environment: {
      CODE_VERSION: '11',  // Force Lambda update
    },
    timeout: Duration.seconds(300),
    memorySize: 1024,
  });
}, {
  resourceGroupName: 'storage'
});

// ベクトル埋め込みワーカー（同じresourceGroupに配置）
export const embedWorker = defineFunction((scope) => {
  const ecrRepo = Repository.fromRepositoryName(
    scope,
    'EmbedWorkerRepo',
    'embed-worker'
  );

  return new Function(scope, 'EmbedWorker', {
    code: Code.fromEcrImage(ecrRepo, {
      tagOrDigest: 'latest'
    }),
    handler: Handler.FROM_IMAGE,
    runtime: Runtime.FROM_IMAGE,
    environment: {
      VECTOR_BUCKET_NAME: 'vector-files',
      COHERE_API_KEY: process.env.COHERE_API_KEY || '',
    },
    timeout: Duration.seconds(300),
    memorySize: 1024,
  });
}, {
  resourceGroupName: 'storage'
});

// S3バケット + トリガー定義（同じバケットで異なるパスにトリガー設定）
export const rawFiles = defineStorage({
  name: 'raw-files',
  isDefault: true,
  access: (allow) => ({
    'private/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete'])
    ],
    'public/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read', 'write', 'delete']) // Development only  
    ],
    'images/*': [
      allow.authenticated.to(['read', 'write']),
      allow.guest.to(['read', 'write']) // Development only
    ],
  }),
  triggers: {
    onUpload: [
      // PDF/PPTX files trigger convert-worker
      {
        function: convertWorker,
        events: ['s3:ObjectCreated:*'],
        prefix: 'public/',
        suffix: '.pdf'
      },
      {
        function: convertWorker,
        events: ['s3:ObjectCreated:*'],
        prefix: 'private/',
        suffix: '.pdf'
      },
      {
        function: convertWorker,
        events: ['s3:ObjectCreated:*'],
        prefix: 'public/',
        suffix: '.pptx'
      },
      {
        function: convertWorker,
        events: ['s3:ObjectCreated:*'],
        prefix: 'private/',
        suffix: '.pptx'
      },
      // Images trigger embed-worker
      {
        function: embedWorker,
        events: ['s3:ObjectCreated:*'],
        prefix: 'images/'
      }
    ]
  }
});

export const vectorFiles = defineStorage({
  name: 'vector-files',
  versioned: true,
  access: (allow) => ({
    'private/*': [allow.authenticated.to(['read', 'write'])],
  }),
});