'use client';

import { useState } from 'react';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import FileUpload from '@/components/FileUpload';
import DocumentList from '@/components/DocumentList';
import SearchInterface from '@/components/SearchInterface';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Upload, FileText, RefreshCw } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';

function HomeContent() {
  const { user } = useAuthenticator((context) => [context.user]);
  const [refreshKey, setRefreshKey] = useState(0);
  const { sessionId, resetSession } = useSession();

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
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div>
          <h1 className="text-2xl font-bold">Vision RAG</h1>
          <p className="text-sm text-muted-foreground">PDFやパワポを画像化して検索・AIが関連画像を見ながら質問に回答するツール</p>
        </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetSession}
              className="h-auto px-3 py-1 text-muted-foreground hover:text-foreground"
            >
              <span className="text-sm">セッション: {sessionId.split('-')[1] || sessionId.slice(0, 8)}</span>
              <RefreshCw className="ml-2 h-3 w-3" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        <div className="grid gap-8">
          {/* Step 1: Upload & Document Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-semibold">
                  1
                </div>
                <Upload className="h-5 w-5" />
                文書のアップロード・管理
              </CardTitle>
              <CardDescription>
                PDFやPowerPointファイル（各50MBまで）をアップロードして、文書ライブラリを表示
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Upload Area */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    新しい文書をアップロード
                  </h3>
                  <FileUpload onUploadComplete={handleUploadComplete} />
                </div>
                
                {/* Documents List */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    あなたの文書
                  </h3>
                  <DocumentList refreshTrigger={refreshKey} />
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
                文書を検索
              </CardTitle>
              <CardDescription>
                アップロードした文書について質問して、AIによる回答を取得
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