'use client';

import { useState } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import FileUpload from '@/components/FileUpload';
import DocumentList from '@/components/DocumentList';
import SearchInterface from '@/components/SearchInterface';

function HomeContent() {
  const { user, signOut } = useAuthenticator((context) => [context.user, context.signOut]);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = (key: string) => {
    console.log('Upload completed:', key);
    // Trigger refresh of document list
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Vision RAG
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Upload PDFs or PowerPoint files and search their content with AI
          </p>
        </div>

        {/* User info and sign out */}
        <div className="flex justify-end mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {user?.signInDetails?.loginId || user?.username}
            </span>
            <button
              onClick={signOut}
              className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="space-y-12">
          {/* Search Section */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6 text-center">
              Search Documents
            </h2>
            <SearchInterface />
          </section>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700" />

          {/* Upload Section */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6 text-center">
              Upload Document
            </h2>
            <FileUpload onUploadComplete={handleUploadComplete} />
          </section>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700" />

          {/* Documents Section */}
          <section>
            <DocumentList key={refreshKey} />
          </section>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Authenticator>
      <HomeContent />
    </Authenticator>
  );
}