import { defineFunction } from '@aws-amplify/backend';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';

export const convertWorker = defineFunction((scope) => {
  return new Function(scope, 'ConvertWorker', {
    runtime: Runtime.PYTHON_3_12,
    handler: 'handler.handler',
    code: Code.fromAsset('amplify/functions/convert-worker/src'),
    environment: {
      DEST_BUCKET: 'images',
    },
    timeout: Duration.seconds(300),
    memorySize: 1024,
  });
}, {
  resourceGroupName: 'functions'
});