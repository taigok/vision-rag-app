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
      <section className="bg-muted/50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            AI-Powered Document Search
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Upload PDFs or PowerPoint files and search their content with advanced AI
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="grid gap-8">
          {/* Search Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Documents
              </CardTitle>
              <CardDescription>
                Ask questions about your uploaded documents and get AI-powered answers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SearchInterface />
            </CardContent>
          </Card>

          {/* Two column layout for upload and documents */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Document
                </CardTitle>
                <CardDescription>
                  Support for PDF and PowerPoint files up to 50MB
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload onUploadComplete={handleUploadComplete} />
              </CardContent>
            </Card>

            {/* Documents Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Your Documents
                </CardTitle>
                <CardDescription>
                  Manage your uploaded documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentList key={refreshKey} />
              </CardContent>
            </Card>
          </div>
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