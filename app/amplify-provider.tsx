'use client';

import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import outputs from '../amplify_outputs.json';

// Configure Amplify once at the top level
Amplify.configure(outputs, {
  ssr: true
});

export default function AmplifyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Authenticator.Provider>
      {children}
    </Authenticator.Provider>
  );
}