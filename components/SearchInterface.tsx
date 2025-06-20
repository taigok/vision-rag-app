'use client';

import { useState } from 'react';
import { Search, Loader2, FileImage, AlertCircle, X, ZoomIn } from 'lucide-react';
import { generateClient } from 'aws-amplify/api';
import { getUrl } from 'aws-amplify/storage';
import outputs from '@/amplify_outputs.json';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useSession } from '@/contexts/SessionContext';
import { Skeleton } from '@/components/ui/skeleton';

interface SearchInterfaceProps {
  isIndexReady?: boolean;
  hasDocuments?: boolean;
}

interface SearchResult {
  answer: string;
  sources: {
    bucket: string;
    key: string;
    document_id: string;
    score: number;
  }[];
  totalResults: number;
}

export default function SearchInterface({ isIndexReady = false, hasDocuments = false }: SearchInterfaceProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { sessionId } = useSession();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [sourceImages, setSourceImages] = useState<{[key: string]: string}>({});
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const [modalImageLoading, setModalImageLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const apiEndpoint = outputs.custom?.API?.endpoint;
      if (!apiEndpoint) {
        throw new Error('API endpoint not configured');
      }

      console.log('API Endpoint:', apiEndpoint);
      console.log('Full URL:', `${apiEndpoint}search`);

      // Get current auth session for API authentication if needed
      const response = await fetch(`${apiEndpoint}search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          topK: 3,
          sessionId: sessionId,
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response body:', errorText);
        throw new Error(`Search failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: SearchResult = await response.json();
      setResults(data);

      // Load source images
      const imageUrls: {[key: string]: string} = {};
      const loadingKeys = new Set(data.sources.map(s => s.key));
      setLoadingImages(loadingKeys);
      
      for (const source of data.sources) {
        try {
          const imageUrl = await getUrl({
            path: source.key,
            options: {
              validateObjectExistence: false,
              expiresIn: 3600, // 1 hour
            },
          });
          imageUrls[source.key] = imageUrl.url.toString();
        } catch (imageError) {
          console.error('Failed to get source image URL:', imageError);
          // Remove from loading state if failed
          setLoadingImages(prev => {
            const next = new Set(prev);
            next.delete(source.key);
            return next;
          });
        }
      }
      setSourceImages(imageUrls);
    } catch (err) {
      console.error('Search error:', err);
      
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        setError('Network error: Unable to connect to the search API. Please check if the backend is deployed.');
      } else {
        setError(err instanceof Error ? err.message : 'Search failed');
        toast.error('Search failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Show message when no documents */}
      {!hasDocuments ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            文書をアップロードしてから質問できるようになります。上のアップロードエリアからPDFやPowerPointファイルをアップロードしてください。
          </AlertDescription>
        </Alert>
      ) : !isIndexReady ? (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            アップロードした文書のインデックスを作成中です...
            <br />
            <span className="text-xs text-muted-foreground">
              文書を画像化してベクトル化しています。完了するまでお待ちください。
            </span>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Search Form */}
          <form onSubmit={handleSearch}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="文書について質問してください..."
                  className="pr-10 border-2 border-primary/30 focus:border-primary shadow-md"
                  disabled={loading}
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
              <Button
                type="submit"
                disabled={loading || !query.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    検索中...
                  </>
                ) : (
                  '検索'
                )}
              </Button>
            </div>
          </form>
        </>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {results && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* AI Answer */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold mb-3">AI回答</h3>
            <div className="prose prose-sm max-w-none">
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                {results.answer}
              </p>
            </div>
          </div>

          {/* Source Documents */}
          {results.sources.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">
                参照画像 <span className="text-sm font-normal text-muted-foreground">({results.totalResults}件)</span>
              </h3>
              <div className="space-y-3">
                {results.sources.map((source, index) => {
                  console.log('Source key:', source.key, 'Document ID:', source.document_id); // Debug log
                  const pageMatch = source.key.match(/page[_-]?(\d+)\.png$/i);
                  const pageNum = pageMatch ? pageMatch[1] : (index + 1).toString();
                  
                  // Extract filename from document_id (which should be the original filename)
                  // document_id format is usually the original filename without extension
                  const fileName = source.document_id.includes('.') 
                    ? source.document_id 
                    : `${source.document_id}.pdf`;
                  
                  const imageUrl = sourceImages[source.key];
                  
                  return (
                    <div
                      key={index}
                      className="p-3 rounded-lg border bg-card cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => {
                        if (imageUrl) {
                          setModalImageLoading(true);
                          setSelectedImage(imageUrl);
                        }
                      }}
                    >
                      <div className="flex gap-3 items-center">
                        {/* Small Image Preview */}
                        <div className="flex-shrink-0">
                          {imageUrl ? (
                            <div className="relative w-12 h-16 rounded border bg-muted overflow-hidden">
                              {loadingImages.has(source.key) ? (
                                <Skeleton className="w-full h-full" />
                              ) : (
                                <>
                                  <img
                                    src={imageUrl}
                                    alt={`Page ${pageNum}`}
                                    className="w-full h-full object-cover"
                                    onLoad={() => {
                                      setLoadingImages(prev => {
                                        const next = new Set(prev);
                                        next.delete(source.key);
                                        return next;
                                      });
                                    }}
                                    onError={() => {
                                      setLoadingImages(prev => {
                                        const next = new Set(prev);
                                        next.delete(source.key);
                                        return next;
                                      });
                                    }}
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
                                    <ZoomIn className="h-3 w-3 text-white" />
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="w-12 h-16 rounded border bg-muted flex items-center justify-center">
                              <FileImage className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        
                        {/* Compact Document Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Page {pageNum}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Score: {source.score.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Results */}
          {results.sources.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                関連する文書が見つかりませんでした。
              </p>
            </div>
          )}
        </div>
      )}

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-2">
          <DialogTitle className="sr-only">ソース文書画像の拡大表示</DialogTitle>
          {selectedImage && (
            <div className="relative">
              {modalImageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted rounded">
                  <Skeleton className="w-full h-[85vh]" />
                </div>
              )}
              <img
                src={selectedImage}
                alt="Document page"
                className="max-w-full max-h-[85vh] object-contain rounded"
                onLoad={() => setModalImageLoading(false)}
                onError={() => setModalImageLoading(false)}
                style={{ display: modalImageLoading ? 'none' : 'block' }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}