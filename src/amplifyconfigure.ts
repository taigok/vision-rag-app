import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';

// Configure Amplify with the outputs
Amplify.configure(outputs, {
  ssr: true // Required for Next.js
});