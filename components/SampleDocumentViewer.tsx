'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, ImageIcon, AlertCircle } from 'lucide-react';
import { SampleDocument } from '@/lib/sample-documents';
import { getUrl, list } from 'aws-amplify/storage';

interface SampleDocumentViewerProps {
  document: SampleDocument;
}

export default function SampleDocumentViewer({ document }: SampleDocumentViewerProps) {
  const [images, setImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    loadSampleImages();
  }, [document.basePath]);

  const loadSampleImages = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const imageUrls: string[] = [];
      const errors: string[] = [];
      
      // サンプル画像を動的に取得
      try {
        const imagesResult = await list({
          path: `${document.basePath}/images/`,
          options: {
            listAll: true
          }
        });
        
        // PNGファイルのみフィルタして、ファイル名でソート
        const imageFiles = imagesResult.items
          .filter(item => item.path && item.path.endsWith('.png'))
          .sort((a, b) => a.path!.localeCompare(b.path!));
        
        for (const imageFile of imageFiles) {
          try {
            const result = await getUrl({
              path: imageFile.path!,
              options: {
                validateObjectExistence: false,
                expiresIn: 3600,
              },
            });
            
            const url = result.url.toString();
            imageUrls.push(url);
          } catch (err: any) {
            console.warn(`Failed to load image ${imageFile.path}:`, err);
            errors.push(imageFile.path!);
          }
        }
      } catch (listErr: any) {
        console.error('Failed to list images:', listErr);
        setError(`画像一覧の取得に失敗しました: ${listErr.message}`);
        return;
      }
      
      if (imageUrls.length === 0) {
        setError(`サンプル文書「${document.name}」の画像が見つかりません。\n\nこのサンプル文書を使用するには、以下のパスにファイルを配置してください：\n${document.basePath}/\n\n処理が完了していない場合は、管理者にお問い合わせください。`);
      } else {
        setImages(imageUrls);
        setCurrentImageIndex(0);
        setImageLoading(true); // Set loading state for the first image
        
        // 一部の画像が見つからない場合の警告
        if (errors.length > 0) {
          console.warn(`Some images not found for ${document.basePath}: ${errors.join(', ')}`);
        }
      }
    } catch (err: any) {
      console.error('Error loading sample images:', err);
      setError(`画像の読み込み中にエラーが発生しました。\n\nエラー詳細: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const nextImage = () => {
    setImageLoading(true);
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setImageLoading(true);
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // getUrlで取得したURLはクリーンアップ不要

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            文書プレビュー
          </CardTitle>
          <CardDescription>
            {document.name} の画像を読み込み中...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-96" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            文書プレビュー
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-semibold">
            2
          </div>
          <ImageIcon className="h-5 w-5" />
          文書プレビュー
        </CardTitle>
        <CardDescription>
          {document.name} ({currentImageIndex + 1} / {images.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 画像表示エリア */}
          <div className="relative">
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
                <Skeleton className="w-full h-96" />
              </div>
            )}
            <img
              src={images[currentImageIndex]}
              alt={`${document.name} - ページ ${currentImageIndex + 1}`}
              className="w-full h-auto max-h-96 object-contain border rounded-lg"
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
              style={{ display: imageLoading ? 'none' : 'block' }}
            />
          </div>

          {/* ナビゲーションボタン */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={prevImage}
              disabled={images.length <= 1}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              前の画像
            </Button>
            
            <span className="text-sm text-muted-foreground">
              {currentImageIndex + 1} / {images.length}
            </span>
            
            <Button
              variant="outline"
              onClick={nextImage}
              disabled={images.length <= 1}
              className="flex items-center gap-2"
            >
              次の画像
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}