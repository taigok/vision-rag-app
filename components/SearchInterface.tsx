'use client';

import { useState } from 'react';
import { Search, Loader2, FileImage, AlertCircle, X, ZoomIn } from 'lucide-react';
import { generateClient } from 'aws-amplify/api';
import { getUrl } from 'aws-amplify/storage';
import outputs from '@/amplify_outputs.json';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';

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

export default function SearchInterface() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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
          topK: 5,
        }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data: SearchResult = await response.json();
      setResults(data);
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
      {/* Search Form */}
      <form onSubmit={handleSearch}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your documents..."
              className="pr-10"
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
                Searching...
              </>
            ) : (
              'Search'
            )}
          </Button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* AI Answer */}
          <Card>
            <CardHeader>
              <CardTitle>AI Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {results.answer}
              </p>
            </CardContent>
          </Card>

          {/* Source Documents */}
          {results.sources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Source Documents</CardTitle>
                <CardDescription>Found {results.totalResults} relevant documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.sources.map((source, index) => {
                  const pageMatch = source.key.match(/page_(\d+)\.png$/);
                  const pageNum = pageMatch ? pageMatch[1] : 'unknown';
                  
                  return (
                    <Card
                      key={index}
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={async () => {
                        try {
                          // Parse the key to determine access level
                          // Format: images/public/{docId}/page_X.png or images/private/{userId}/{docId}/page_X.png
                          let storageKey = source.key;
                          let accessLevel: 'guest' | 'private' = 'guest';
                          
                          if (source.key.startsWith('images/')) {
                            storageKey = source.key.substring(7); // Remove 'images/' prefix
                          }
                          
                          // For public files, remove the 'public/' prefix as well
                          if (storageKey.startsWith('public/')) {
                            storageKey = storageKey.substring(7); // Remove 'public/' prefix
                            accessLevel = 'guest';
                          } else if (storageKey.startsWith('private/')) {
                            accessLevel = 'private';
                          }
                          
                          const result = await getUrl({
                            key: storageKey,
                            options: {
                              accessLevel: accessLevel,
                              expiresIn: 3600,
                            },
                          });
                          setSelectedImage(result.url.toString());
                        } catch (err) {
                          console.error('Failed to get image URL:', err);
                        }
                      }}
                    >
                      <CardContent className="flex items-center gap-3 p-3">
                        <FileImage className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            Document: {source.document_id.substring(0, 8)}...
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Page {pageNum} • Score: {source.score.toFixed(3)}
                          </p>
                        </div>
                        <ZoomIn className="w-4 h-4 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* No Results */}
          {results.sources.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">
                  No relevant documents found for your query.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-2">
          <img
            src={selectedImage || ''}
            alt="Document page"
            className="max-w-full max-h-[85vh] object-contain rounded"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}