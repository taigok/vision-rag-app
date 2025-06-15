import { defineFunction } from '@aws-amplify/backend';
import { Function, Runtime, Code, Handler } from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Duration } from 'aws-cdk-lib';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const searchRouter = defineFunction((scope) => {
  const ecrRepo = Repository.fromRepositoryName(
    scope, 
    'SearchRouterRepo', 
    'search-router'
  );

  // Read tag from file if exists, otherwise use latest
  const tagFile = path.join(__dirname, '.ecr-tag');
  let tag = 'latest';
  if (fs.existsSync(tagFile)) {
    tag = fs.readFileSync(tagFile, 'utf-8').trim();
  }

  return new Function(scope, 'SearchRouterV8', {
    code: Code.fromEcrImage(ecrRepo, {
      tagOrDigest: tag
    }),
    handler: Handler.FROM_IMAGE,
    runtime: Runtime.FROM_IMAGE,
    environment: {
      CODE_VERSION: '11', // Force redeployment
    },
    timeout: Duration.seconds(60),
    memorySize: 1024,
  });
}, {
  resourceGroupName: 'functions'
});