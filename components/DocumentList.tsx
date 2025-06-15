'use client';

import { useState, useEffect } from 'react';
import { list, remove, getUrl } from 'aws-amplify/storage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FileText, FileIcon, RefreshCw, Trash2, AlertCircle, Image, ZoomIn, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/contexts/SessionContext';

interface Document {
  key: string;
  size?: number;
  lastModified?: Date;
}

interface ImageFile {
  key: string;
  url: string;
}

interface DocumentListProps {
  refreshTrigger?: number;
  onIndexStatusChange?: (isReady: boolean, hasDocuments: boolean) => void;
}

export default function DocumentList({ refreshTrigger, onIndexStatusChange }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isIndexReady, setIsIndexReady] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
  const { sessionId } = useSession();

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      // List files in the session's documents folder  
      const result = await list({
        path: `sessions/${sessionId}/documents/`,
        options: {
          listAll: true
        }
      });

      console.log('Storage list result:', result);
      
      const docs = result.items
        .filter(item => item.path && !item.path.endsWith('/')) // Filter out folder entries
        .map(item => ({
          key: item.path,
          size: item.size,
          lastModified: item.lastModified,
        }));

      setDocuments(docs);
      setError(null);
      
      // Fetch images if documents exist
      if (docs.length > 0) {
        try {
          const imagesResult = await list({
            path: `sessions/${sessionId}/images/`,
            options: {
              listAll: true
            }
          });
          
          const imageFiles = await Promise.all(
            imagesResult.items
              .filter(item => item.path && item.path.endsWith('.png'))
              .map(async (item) => {
                try {
                  const imageUrl = await getUrl({
                    path: item.path,
                    options: {
                      validateObjectExistence: false,
                      expiresIn: 3600, // 1 hour
                    },
                  });
                  return {
                    key: item.path,
                    url: imageUrl.url.toString(),
                  };
                } catch (error) {
                  console.error('Failed to get image URL:', error);
                  return null;
                }
              })
          ).then(results => results.filter(Boolean) as ImageFile[]);
          
          setImages(imageFiles);
        } catch (imageError) {
          console.log('No images found yet');
          setImages([]);
        }
      } else {
        setImages([]);
      }
      
      const hasDocuments = docs.length > 0;
      
      // Check if index file exists to determine if search is ready
      if (hasDocuments) {
        try {
          const indexResult = await list({
            path: `sessions/${sessionId}/index.faiss`,
          });
          const indexExists = indexResult.items.length > 0;
          setIsIndexReady(indexExists);
          onIndexStatusChange?.(indexExists, hasDocuments);
        } catch (indexError) {
          console.log('Index file not found yet');
          setIsIndexReady(false);
          onIndexStatusChange?.(false, hasDocuments);
        }
      } else {
        setIsIndexReady(false);
        onIndexStatusChange?.(false, hasDocuments);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      setError('Failed to load documents');
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      setDeletingFiles(prev => new Set(prev).add(key));
      
      await remove({
        path: key,
      });

      // Refresh the list
      await fetchDocuments();
      toast.success('ファイルを削除しました');
    } catch (error) {
      console.error('Failed to delete document:', error);
      setError('ファイルの削除に失敗しました');
      toast.error('ファイルの削除に失敗しました');
    } finally {
      setDeletingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [refreshTrigger]);

  // Check index status and update images
  const checkIndexStatus = async () => {
    try {
      const indexResult = await list({
        path: `sessions/${sessionId}/index.faiss`,
      });
      const indexExists = indexResult.items.length > 0;
      if (indexExists !== isIndexReady) {
        setIsIndexReady(indexExists);
        onIndexStatusChange?.(indexExists, documents.length > 0);
      }

      // Also check for new images
      if (documents.length > 0) {
        try {
          const imagesResult = await list({
            path: `sessions/${sessionId}/images/`,
            options: {
              listAll: true
            }
          });
          
          const imageCount = imagesResult.items.filter(item => item.path && item.path.endsWith('.png')).length;
          
          if (imageCount !== images.length) {
            const imageFiles = await Promise.all(
              imagesResult.items
                .filter(item => item.path && item.path.endsWith('.png'))
                .map(async (item) => {
                  try {
                    const imageUrl = await getUrl({
                      path: item.path,
                      options: {
                        validateObjectExistence: false,
                        expiresIn: 3600, // 1 hour
                      },
                    });
                    return {
                      key: item.path,
                      url: imageUrl.url.toString(),
                    };
                  } catch (error) {
                    console.error('Failed to get image URL:', error);
                    return null;
                  }
                })
            ).then(results => results.filter(Boolean) as ImageFile[]);
            
            setImages(imageFiles);
          }
        } catch (imageError) {
          // No images yet
        }
      }
    } catch (indexError) {
      // Index file not found yet, keep current state
    }
  };

  // Poll for index file when documents exist but index is not ready
  useEffect(() => {
    if (!isIndexReady && documents.length > 0) {
      const interval = setInterval(checkIndexStatus, 3000); // Check every 3 seconds
      return () => clearInterval(interval);
    }
  }, [isIndexReady, documents.length, sessionId]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'Unknown date';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };


  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">文書を読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="text-center">
          <Button onClick={fetchDocuments}>
            再試行
          </Button>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          まだ文書がアップロードされていません。
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="space-y-2">
        {documents.map((doc) => (
          <div key={doc.key} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {doc.key.endsWith('.pdf') ? (
                  <FileText className="w-6 h-6 text-red-500" />
                ) : (
                  <FileIcon className="w-6 h-6 text-orange-500" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {doc.key.split('/').pop() || doc.key}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(doc.size)} • {formatDate(doc.lastModified)}
                </p>
              </div>
            </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    disabled={deletingFiles.has(doc.key)}
                  >
                    {deletingFiles.has(doc.key) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>ファイルを削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      <strong>「{doc.key.split('/').pop() || doc.key}」</strong>を削除してもよろしいですか？
                      <br />
                      <br />
                      このファイルに関連する以下のデータもすべて削除されます：
                      <br />
                      • 変換された画像ファイル
                      <br />
                      • 検索インデックスデータ  
                      <br />
                      <br />
                      <span className="text-destructive font-medium">この操作は元に戻せません。</span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deletingFiles.has(doc.key)}>キャンセル</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => handleDelete(doc.key)}
                      disabled={deletingFiles.has(doc.key)}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {deletingFiles.has(doc.key) ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          削除中...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          削除する
                        </>
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
          </div>
        ))}
      </div>

      {/* Images Gallery */}
      {images.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Image className="h-4 w-4" />
            変換された画像 ({images.length}枚)
          </h4>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
            {images.map((image, index) => (
              <div
                key={image.key}
                className="relative flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 rounded-lg border bg-muted cursor-pointer hover:shadow-md transition-all group overflow-hidden"
                onClick={() => setSelectedImage(image.url)}
              >
                <img
                  src={image.url}
                  alt={`Page ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg">
                  <ZoomIn className="h-4 w-4 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="absolute bottom-1 left-1 text-xs bg-black/70 text-white px-1 py-0.5 rounded text-center min-w-4">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl w-full">
          <DialogTitle className="sr-only">文書画像の拡大表示</DialogTitle>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Document page"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}