'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FileText, ImageIcon } from 'lucide-react';
import { SAMPLE_DOCUMENTS, SampleDocument } from '@/lib/sample-documents';

interface SampleDocumentSelectorProps {
  onSelect: (document: SampleDocument) => void;
  selectedDocument?: SampleDocument | null;
}

export default function SampleDocumentSelector({ onSelect, selectedDocument }: SampleDocumentSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SAMPLE_DOCUMENTS.map((doc) => (
          <Card 
            key={doc.id} 
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedDocument?.id === doc.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onSelect(doc)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4" />
                {doc.name}
              </CardTitle>
              <CardDescription className="text-sm">
                {doc.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Badge variant="secondary" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  {doc.totalPages}ページ
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <ImageIcon className="h-3 w-3 mr-1" />
                  {doc.imageCount}画像
                </Badge>
              </div>
              <Button 
                size="sm" 
                variant={selectedDocument?.id === doc.id ? "default" : "outline"}
                className="w-full"
              >
                {selectedDocument?.id === doc.id ? '選択中' : '選択'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}