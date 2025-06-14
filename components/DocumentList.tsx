'use client';

import { useState, useEffect } from 'react';
import { list, remove } from 'aws-amplify/storage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, FileIcon, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Document {
  key: string;
  size?: number;
  lastModified?: Date;
}

export default function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      // List files in the public folder  
      const result = await list({
        prefix: `public/`,
      });

      const docs = result.items.map(item => ({
        key: item.key,
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
  }, []);

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
        <p className="text-muted-foreground">Loading documents...</p>
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
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">
            No documents uploaded yet. Upload a PDF or PPTX file to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Uploaded Documents</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={fetchDocuments}
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {documents.map((doc) => (
          <Card key={doc.key}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {doc.key.endsWith('.pdf') ? (
                    <FileText className="w-8 h-8 text-red-500" />
                  ) : (
                    <FileIcon className="w-8 h-8 text-orange-500" />
                  )}
                </div>
                <div>
                  <p className="font-medium">
                    {doc.key.split('/').pop() || doc.key}
                  </p>
                  <p className="text-sm text-muted-foreground">
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
                    <AlertDialogTitle>Delete Document</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this document? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(doc.key)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}