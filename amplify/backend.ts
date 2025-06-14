import { defineBackend, secret } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { rawFiles, vectorFiles, convertWorker, embedWorker } from './storage/resource';
import { searchRouter } from './functions/search-router/resource';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  rawFiles,
  vectorFiles,
  convertWorker,
  embedWorker,
  searchRouter,
});

// Configure S3 event notifications for Lambda triggers
const rawFilesBucket = backend.rawFiles.resources.bucket;
const vectorFilesBucket = backend.vectorFiles.resources.bucket;

// Grant permissions for convert-worker and embed-worker (same resourceGroup as storage)
rawFilesBucket.grantRead(backend.convertWorker.resources.lambda);
rawFilesBucket.grantWrite(backend.convertWorker.resources.lambda);  // Allow writing images/ folder to same bucket
rawFilesBucket.grantRead(backend.embedWorker.resources.lambda);   // Read images from same bucket
vectorFilesBucket.grantWrite(backend.embedWorker.resources.lambda);

// Grant permissions for search-router
vectorFilesBucket.grantRead(backend.searchRouter.resources.lambda);
rawFilesBucket.grantRead(backend.searchRouter.resources.lambda);

// Configure S3 event notifications

// PDF/PPTX files trigger convert-worker
rawFilesBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(backend.convertWorker.resources.lambda),
  { prefix: 'public/', suffix: '.pdf' }
);
rawFilesBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(backend.convertWorker.resources.lambda),
  { prefix: 'private/', suffix: '.pdf' }
);
rawFilesBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(backend.convertWorker.resources.lambda),
  { prefix: 'public/', suffix: '.pptx' }
);
rawFilesBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(backend.convertWorker.resources.lambda),
  { prefix: 'private/', suffix: '.pptx' }
);

// Images trigger embed-worker
rawFilesBucket.addEventNotification(
  EventType.OBJECT_CREATED,
  new LambdaDestination(backend.embedWorker.resources.lambda),
  { prefix: 'images/' }
);

// TODO: Additional configuration to be added
// - EventBridge scheduling for index merging
// - REST API endpoint for search functionality
