import { defineStorage, defineFunction } from '@aws-amplify/backend';
import { Function, Code, Runtime, Handler } from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Duration } from 'aws-cdk-lib';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define functions in storage resourceGroup for S3 triggers
export const convertWorker = defineFunction((scope) => {
  const ecrRepo = Repository.fromRepositoryName(
    scope, 
    'ConvertWorkerRepo', 
    'convert-worker'
  );

  // Read tag from file if exists, otherwise use latest
  const tagFile = path.join(__dirname, '../../functions/convert-worker/.ecr-tag');
  let tag = 'latest';
  if (fs.existsSync(tagFile)) {
    tag = fs.readFileSync(tagFile, 'utf-8').trim();
  }

  return new Function(scope, 'ConvertWorkerV3', {
    code: Code.fromEcrImage(ecrRepo, {
      tagOrDigest: tag
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

  // Read tag from file if exists, otherwise use latest
  const tagFile = path.join(__dirname, '../../functions/embed-worker/.ecr-tag');
  let tag = 'latest';
  if (fs.existsSync(tagFile)) {
    tag = fs.readFileSync(tagFile, 'utf-8').trim();
  }

  return new Function(scope, 'EmbedWorkerV10', {
    code: Code.fromEcrImage(ecrRepo, {
      tagOrDigest: tag
    }),
    handler: Handler.FROM_IMAGE,
    runtime: Runtime.FROM_IMAGE,
    environment: {
      CODE_VERSION: '14', // Force redeployment
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
      allow.authenticated.to(['read', 'write', 'delete'])
    ],
    'images/*': [
      allow.authenticated.to(['read', 'write'])
    ],
    'sessions/*': [
      allow.authenticated.to(['read', 'write', 'delete'])
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