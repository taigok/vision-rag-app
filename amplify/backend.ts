import { defineBackend, secret } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { rawFiles, images, vectorFiles } from './storage/resource';
import { convertWorker } from './functions/convert-worker/resource';
import { embedWorker } from './functions/embed-worker/resource';
import { indexMerger } from './functions/index-merger/resource';
import { searchRouter } from './functions/search-router/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  rawFiles,
  images,
  vectorFiles,
  convertWorker,
  embedWorker,
  indexMerger,
  searchRouter,
});

// TODO: Advanced configuration will be added step by step after basic deployment succeeds
// - S3 triggers for automatic processing
// - EventBridge scheduling for index merging
// - REST API endpoint for search functionality
// - IAM permissions for cross-bucket access
