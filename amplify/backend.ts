import { defineBackend, secret } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { rawFiles, vectorFiles, convertWorker, embedWorker } from './storage/resource';
import { indexMerger } from './functions/index-merger/resource';
import { searchRouter } from './functions/search-router/resource';

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
  indexMerger,
  searchRouter,
});

// Grant necessary permissions for Lambda functions to access S3 buckets
const rawFilesBucket = backend.rawFiles.resources.bucket;
const vectorFilesBucket = backend.vectorFiles.resources.bucket;

// Grant permissions for convert-worker and embed-worker (same resourceGroup as storage)
rawFilesBucket.grantRead(backend.convertWorker.resources.lambda);
rawFilesBucket.grantWrite(backend.convertWorker.resources.lambda);  // Allow writing images/ folder to same bucket
rawFilesBucket.grantRead(backend.embedWorker.resources.lambda);   // Read images from same bucket
vectorFilesBucket.grantWrite(backend.embedWorker.resources.lambda);

// Grant permissions for other functions in functions resourceGroup
vectorFilesBucket.grantRead(backend.indexMerger.resources.lambda);
vectorFilesBucket.grantWrite(backend.indexMerger.resources.lambda);

// TODO: Additional configuration to be added
// - EventBridge scheduling for index merging
// - REST API endpoint for search functionality
