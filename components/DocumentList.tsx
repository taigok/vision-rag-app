'use client';

import { useState, useEffect } from 'react';
import { list, remove } from 'aws-amplify/storage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, FileIcon, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/contexts/SessionContext';

interface Document {
  key: string;
  size?: number;
  lastModified?: Date;
}

interface DocumentListProps {
  refreshTrigger?: number;
}

export default function DocumentList({ refreshTrigger }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      await remove({
        path: key,
      });

      // Refresh the list
      await fetchDocuments();
      toast.success('Document deleted successfully');
    } catch (error) {
      console.error('Failed to delete document:', error);
      setError('Failed to delete document');
      toast.error('Failed to delete document');
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [refreshTrigger]);

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
      <div className="flex justify-end mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchDocuments}
          title="更新"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

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
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>文書を削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      この文書を削除してもよろしいですか？この操作は元に戻せません。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(doc.key)}>
                      削除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
          </div>
        ))}
      </div>
    </div>
  );
}