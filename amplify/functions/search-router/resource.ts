import { defineFunction } from '@aws-amplify/backend';
import { Function, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';

export const searchRouter = defineFunction((scope) => {
  return new Function(scope, 'SearchRouter', {
    runtime: Runtime.PYTHON_3_12,
    handler: 'handler.handler',
    code: Code.fromAsset('amplify/functions/search-router/src'),
    environment: {
      COHERE_API_KEY: process.env.COHERE_API_KEY || '',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      VECTOR_BUCKET: 'vector-files',
      IMAGES_BUCKET: 'images',
    },
    timeout: Duration.seconds(60),
    memorySize: 1024,
  });
}, {
  resourceGroupName: 'functions'
});