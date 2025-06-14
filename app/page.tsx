'use client';

import { useState } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import FileUpload from '@/components/FileUpload';
import DocumentList from '@/components/DocumentList';
import SearchInterface from '@/components/SearchInterface';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Upload, FileText, LogOut } from 'lucide-react';

function HomeContent() {
  const { user, signOut } = useAuthenticator((context) => [context.user, context.signOut]);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = (key: string) => {
    console.log('Upload completed:', key);
    // Trigger refresh of document list
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold">Vision RAG</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {(user?.signInDetails?.loginId || user?.username || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  {user?.signInDetails?.loginId || user?.username}
                </span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            AI-Powered Document Search
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Upload your documents and search their content with AI - it's that simple
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="grid gap-8">
          {/* Step 1: Upload & Document Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-semibold">
                  1
                </div>
                <Upload className="h-5 w-5" />
                Upload & Manage Documents
              </CardTitle>
              <CardDescription>
                Upload PDF or PowerPoint files (up to 50MB each) and view your document library
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Upload Area */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload New Document
                  </h3>
                  <FileUpload onUploadComplete={handleUploadComplete} />
                </div>
                
                {/* Documents List */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Your Documents
                  </h3>
                  <DocumentList key={refreshKey} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Search Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-semibold">
                  2
                </div>
                <Search className="h-5 w-5" />
                Search Your Documents
              </CardTitle>
              <CardDescription>
                Ask questions about your uploaded documents and get AI-powered answers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SearchInterface />
            </CardContent>
          </Card>
        </div>
      </main>
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