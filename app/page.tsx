'use client';

import { useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import FileUpload from '@/components/FileUpload';
import DocumentList from '@/components/DocumentList';
import SearchInterface from '@/components/SearchInterface';
import SampleDocumentSelector from '@/components/SampleDocumentSelector';
import SampleDocumentViewer from '@/components/SampleDocumentViewer';
import SampleSearchInterface from '@/components/SampleSearchInterface';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Upload, FileText, RefreshCw, Loader2, Trash2, BookOpen } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { SampleDocument } from '@/lib/sample-documents';

function HomeContent() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isIndexReady, setIsIndexReady] = useState(false);
  const [hasDocuments, setHasDocuments] = useState(false);
  const [selectedSampleDocument, setSelectedSampleDocument] = useState<SampleDocument | null>(null);
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
        <Tabs defaultValue="upload" className="w-full">
          <TabsList>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              自分の文書をアップロード
            </TabsTrigger>
            <TabsTrigger value="samples" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              サンプル文書を試す
            </TabsTrigger>
          </TabsList>

          {/* アップロード・検索タブ */}
          <TabsContent value="upload" className="space-y-6">
            {/* Step 1: Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-semibold">
                    1
                  </div>
                  <Upload className="h-5 w-5" />
                  文書アップロード
                </CardTitle>
                <CardDescription>
                  PDFやPowerPointファイル（50MBまで・1ファイル制限）をアップロード
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload onUploadComplete={handleUploadComplete} hasDocuments={hasDocuments} />
              </CardContent>
            </Card>

            {/* Step 2: Image Conversion */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-semibold">
                    2
                  </div>
                  <FileText className="h-5 w-5" />
                  画像化・埋め込み処理
                </CardTitle>
                <CardDescription>
                  PDF/PPTXをPNG画像に変換→画像からベクトル埋め込み生成→検索用インデックス作成
                  <br />
                  <span className="text-xs opacity-70">埋め込みモデル: Cohere Embed V4 (マルチモーダル)</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentList refreshTrigger={refreshKey} onIndexStatusChange={handleIndexStatusChange} />
              </CardContent>
            </Card>

            {/* Step 3: Search Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-semibold">
                    3
                  </div>
                  <Search className="h-5 w-5" />
                  文書を検索
                </CardTitle>
                <CardDescription>
                  質問文をベクトル化→類似画像をベクトル検索→関連画像をAIが解析して回答生成
                  <br />
                  <span className="text-xs opacity-70">応答生成モデル: Gemini 2.5 Flash</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SearchInterface isIndexReady={isIndexReady} hasDocuments={hasDocuments} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* サンプル文書タブ */}
          <TabsContent value="samples" className="space-y-8">
            {/* サンプル文書選択 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-semibold">
                    1
                  </div>
                  <BookOpen className="h-5 w-5" />
                  サンプル文書を選択
                </CardTitle>
                <CardDescription>
                  事前に処理された文書から選択して、すぐに検索機能を試すことができます
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SampleDocumentSelector 
                  onSelect={setSelectedSampleDocument}
                  selectedDocument={selectedSampleDocument}
                />
              </CardContent>
            </Card>

            {selectedSampleDocument && (
              <>
                {/* 選択された文書の画像表示 */}
                <SampleDocumentViewer document={selectedSampleDocument} />

                {/* 検索インターフェース */}
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
                      質問文をベクトル化→類似画像をベクトル検索→関連画像をAIが解析して回答生成
                      <br />
                      <span className="text-xs opacity-70">応答生成モデル: Gemini 2.5 Flash</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SampleSearchInterface selectedDocument={selectedSampleDocument} />
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
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