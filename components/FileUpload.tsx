'use client';

import { useState, useCallback } from 'react';
import { uploadData } from 'aws-amplify/storage';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';

interface FileUploadProps {
  onUploadComplete?: (key: string) => void;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const { sessionId } = useSession();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF or PPTX file');
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 50MB');
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Use session-based path structure
      const filePath = `sessions/${sessionId}/documents/${file.name}`;
      
      const result = await uploadData({
        path: filePath,
        data: file,
        options: {
          onProgress: ({ transferredBytes, totalBytes }) => {
            if (totalBytes) {
              setUploadProgress(Math.round((transferredBytes / totalBytes) * 100));
            }
          },
        },
      }).result;

      console.log('Upload succeeded:', result);
      
      if (onUploadComplete) {
        onUploadComplete(result.path);
      }
      
      // Show success toast
      toast.success('File uploaded successfully!');
      
      // Reset state after successful upload
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = 'Upload failed. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <Card
        className={`relative border-2 border-dashed p-8 transition-colors ${
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25'
        } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".pdf,.pptx"
            onChange={handleChange}
            disabled={isUploading}
          />
          
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center cursor-pointer"
          >
            <Upload className="w-12 h-12 mb-4 text-muted-foreground" />
            
            <p className="mb-2 text-sm text-muted-foreground">
              <span className="font-semibold">クリックしてアップロード</span> またはドラッグ&ドロップ
            </p>
            <p className="text-xs text-muted-foreground">
              PDFまたはPPTX（最大50MB）
            </p>
          </label>
      </Card>

      {/* Progress bar */}
      {isUploading && (
        <div className="mt-4">
          <Progress value={uploadProgress} className="w-full" />
          <p className="mt-2 text-sm text-center text-muted-foreground">
            アップロード中... {uploadProgress}%
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}