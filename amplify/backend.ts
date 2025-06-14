import { defineBackend } from '@aws-amplify/backend';
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

// TODO: Add S3 triggers, EventBridge rules, and API Gateway after initial deployment
// This will be configured in a separate step to avoid circular dependencies
