import { defineFunction } from '@aws-amplify/backend';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';

export const indexMerger = defineFunction((scope) => {
  return new Function(scope, 'IndexMerger', {
    runtime: Runtime.PYTHON_3_12,
    handler: 'handler.handler',
    code: Code.fromAsset('amplify/functions/index-merger/src'),
    environment: {
      VECTOR_BUCKET: 'vector-files',
    },
    timeout: Duration.seconds(900),
    memorySize: 2048,
  });
}, {
  resourceGroupName: 'functions'
});