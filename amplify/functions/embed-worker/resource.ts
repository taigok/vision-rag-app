import { defineFunction } from '@aws-amplify/backend';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';

export const embedWorker = defineFunction((scope) => {
  return new Function(scope, 'EmbedWorker', {
    runtime: Runtime.PYTHON_3_12,
    handler: 'handler.handler',
    code: Code.fromAsset('amplify/functions/embed-worker/src'),
    environment: {
      COHERE_API_KEY: process.env.COHERE_API_KEY || '',
      VECTOR_BUCKET_NAME: 'vector-files',
      VECTOR_BUCKET: 'vector-files',
    },
    timeout: Duration.seconds(300),
    memorySize: 1024,
  });
}, {
  resourceGroupName: 'functions'
});