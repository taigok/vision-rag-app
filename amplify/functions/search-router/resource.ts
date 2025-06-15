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

  return new Function(scope, 'SearchRouterV4', {
    code: Code.fromEcrImage(ecrRepo, {
      tagOrDigest: 'latest'
    }),
    handler: Handler.FROM_IMAGE,
    runtime: Runtime.FROM_IMAGE,
    environment: {
      VECTOR_BUCKET: 'amplify-visionragapp-node-vectorfilesbucketa77f356-ztjiv9yb4lwz',
      RAW_FILES_BUCKET: 'amplify-visionragapp-node-s-rawfilesbucketb0479f06-w1m4dpdutqq3',
      CODE_VERSION: '7', // Fixed CORS headers for all responses
    },
    timeout: Duration.seconds(60),
    memorySize: 1024,
  });
}, {
  resourceGroupName: 'functions'
});