import { defineFunction } from '@aws-amplify/backend';
import { Function, Runtime, Code, Handler } from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Duration } from 'aws-cdk-lib';

export const searchRouter = defineFunction((scope) => {
  const ecrRepo = Repository.fromRepositoryName(
    scope, 
    'SearchRouterRepo', 
    'search-router'
  );

  return new Function(scope, 'SearchRouterV7', {
    code: Code.fromEcrImage(ecrRepo, {
      tagOrDigest: 'latest'
    }),
    handler: Handler.FROM_IMAGE,
    runtime: Runtime.FROM_IMAGE,
    environment: {
      CODE_VERSION: '10', // Fixed bucket environment variable name
    },
    timeout: Duration.seconds(60),
    memorySize: 1024,
  });
}, {
  resourceGroupName: 'functions'
});