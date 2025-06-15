'use client';

import { useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import FileUpload from '@/components/FileUpload';
import DocumentList from '@/components/DocumentList';
import SearchInterface from '@/components/SearchInterface';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Upload, FileText, RefreshCw, Loader2, Trash2 } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';

function HomeContent() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isIndexReady, setIsIndexReady] = useState(false);
  const [hasDocuments, setHasDocuments] = useState(false);
  const { sessionId, resetSession, clearSession, isResetting } = useSession();

  const handleUploadComplete = (key: string) => {
    console.log('Upload completed:', key);
    // Trigger refresh of document list
    setRefreshKey(prev => prev + 1);
  };

  const handleIndexStatusChange = (isReady: boolean, hasDocsValue: boolean) => {
    setIsIndexReady(isReady);
    setHasDocuments(hasDocsValue);
  };

  const handleClearSession = async () => {
    await clearSession();
    // Reset UI state after clearing session
    setIsIndexReady(false);
    setHasDocuments(false);
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
                <p className="text-sm text-muted-foreground">PDFやパワポをアップロード→画像化・ベクトル化→質問すると関連画像をAIが参照して回答するデモアプリ</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground">
                セッション: {sessionId.split('-')[1] || sessionId.slice(0, 8)}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isResetting || !hasDocuments}
                    className="h-auto px-3 py-1"
                  >
                    <Trash2 className="mr-2 h-3 w-3" />
                    <span className="text-sm">アップロード済みファイル削除</span>
                    {isResetting && <Loader2 className="ml-2 h-3 w-3 animate-spin" />}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>アップロード済みファイルを削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      アップロードしたすべてのファイルを削除しますか？
                      <br />
                      <br />
                      削除されるもの：
                      <br />
                      • PDFやパワーポイントファイル
                      <br />
                      • 変換された画像
                      <br />
                      • 検索用のデータ
                      <br />
                      <br />
                      削除後、ページが自動的に更新され、新しくファイルをアップロードできます。
                      <br />
                      <br />
                      <span className="text-destructive font-medium">この操作は元に戻せません。</span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction onClick={resetSession} disabled={isResetting}>
                      {isResetting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          削除中...
                        </>
                      ) : (
                        'アップロード済みファイル削除'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
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
                PDFやPowerPointファイル（50MBまで・1ファイル制限）をアップロードして、文書ライブラリを表示
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
                  <FileUpload onUploadComplete={handleUploadComplete} hasDocuments={hasDocuments} />
                </div>
                
                {/* Documents List */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      あなたの文書
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRefreshKey(prev => prev + 1)}
                      title="更新"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <DocumentList refreshTrigger={refreshKey} onIndexStatusChange={handleIndexStatusChange} />
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
              <SearchInterface isIndexReady={isIndexReady} hasDocuments={hasDocuments} />
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