/**
 * Vision RAG App Backend Configuration - PDFやPowerPointの内容を画像化してベクトル検索し、AIが文書の内容について回答するシステム
 */
import { defineBackend, secret } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { rawFiles, convertWorker, embedWorker } from './storage/resource';
import { searchRouter } from './functions/search-router/resource';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { RestApi, LambdaIntegration, Cors } from 'aws-cdk-lib/aws-apigateway';
import { Stack } from 'aws-cdk-lib';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  rawFiles,
  convertWorker,
  embedWorker,
  searchRouter,
});

// Configure S3 event notifications for Lambda triggers
const rawFilesBucket = backend.rawFiles.resources.bucket;

// Grant permissions for convert-worker and embed-worker (same resourceGroup as storage)
rawFilesBucket.grantRead(backend.convertWorker.resources.lambda);
rawFilesBucket.grantWrite(backend.convertWorker.resources.lambda);  // Allow writing images/ folder to same bucket
rawFilesBucket.grantRead(backend.embedWorker.resources.lambda);   // Read images from same bucket
rawFilesBucket.grantWrite(backend.embedWorker.resources.lambda);  // Write session indexes to same bucket

// Grant permissions for search-router
rawFilesBucket.grantRead(backend.searchRouter.resources.lambda);

// Add storage bucket name as environment variable (standard Amplify Gen 2 pattern)
(backend.searchRouter.resources.lambda as any).addEnvironment(
  'STORAGE_BUCKET_NAME', 
  rawFilesBucket.bucketName
);

// Configure S3 event notifications

// Session-based document triggers
rawFilesBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(backend.convertWorker.resources.lambda),
  { prefix: 'sessions/', suffix: '.pdf' }
);
rawFilesBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(backend.convertWorker.resources.lambda),
  { prefix: 'sessions/', suffix: '.pptx' }
);

// Session-based images trigger
rawFilesBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(backend.embedWorker.resources.lambda),
  { prefix: 'sessions/', suffix: '.png' }
);

// Create REST API for search functionality
const stack = Stack.of(backend.searchRouter.resources.lambda);
const api = new RestApi(stack, 'VisionRAGApi', {
  restApiName: 'Vision RAG Search API - PDFやPowerPointの内容を画像化してベクトル検索し、AIが文書の内容について回答するシステム',
  description: 'API for searching documents with Vision RAG',
  defaultCorsPreflightOptions: {
    allowOrigins: ['https://your-production-domain.com', 'http://localhost:3000'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
    allowCredentials: false,
  },
});

// Add search endpoint
const searchResource = api.root.addResource('search');

searchResource.addMethod(
  'POST',
  new LambdaIntegration(backend.searchRouter.resources.lambda, {
    proxy: true,
  })
);

// Add API endpoint to outputs
backend.addOutput({
  custom: {
    API: {
      endpoint: api.url,
      region: stack.region,
    },
  },
});
