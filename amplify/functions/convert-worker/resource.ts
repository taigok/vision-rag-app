import { defineFunction } from '@aws-amplify/backend';
import { Function, Code, Runtime, Handler } from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Duration } from 'aws-cdk-lib';

export const convertWorker = defineFunction((scope) => {
  // Reference existing ECR repository
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
  resourceGroupName: 'functions'
});