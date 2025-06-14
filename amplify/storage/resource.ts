import { defineStorage, defineFunction } from '@aws-amplify/backend';
import { Function, Code, Runtime, Handler } from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Duration } from 'aws-cdk-lib';

// Define functions in storage resourceGroup for S3 triggers
export const convertWorker = defineFunction((scope) => {
  const ecrRepo = Repository.fromRepositoryName(
    scope, 
    'ConvertWorkerRepo', 
    'convert-worker'
  );

  return new Function(scope, 'ConvertWorker', {
    code: Code.fromEcrImage(ecrRepo, {
      tagOrDigest: 'latest'
    }),
    handler: Handler.FROM_IMAGE,
    runtime: Runtime.FROM_IMAGE,
    environment: {
      DEST_BUCKET_NAME: 'images',
      IMAGES_BUCKET: 'images',
    },
    timeout: Duration.seconds(300),
    memorySize: 1024,
  });
}, {
  resourceGroupName: 'storage'
});

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
      COHERE_API_KEY: process.env.COHERE_API_KEY || '',
      VECTOR_BUCKET_NAME: 'vector-files',
      VECTOR_BUCKET: 'vector-files',
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
});

export const vectorFiles = defineStorage({
  name: 'vector-files',
  versioned: true,
  access: (allow) => ({
    'private/*': [allow.authenticated.to(['read', 'write'])],
  }),
});