
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Text, Move, Image } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';

interface HeaderProps {
  presentationTitle: string;
  onTitleChange: (title: string) => void;
  onAddSlide: () => void;
  onFilesUploaded: (files: File[]) => void;
}

export const Header: React.FC<HeaderProps> = ({
  presentationTitle,
  onTitleChange,
  onAddSlide,
  onFilesUploaded
}) => {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <Input
            value={presentationTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            className="text-lg font-medium border-none shadow-none p-0 h-auto focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <FileUpload onFilesUploaded={onFilesUploaded} />
        
        <Button
          variant="outline"
          size="sm"
          onClick={onAddSlide}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Slide
        </Button>

        <div className="flex items-center gap-1 ml-4">
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <Text className="w-4 h-4" />
            Text
          </Button>
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <Move className="w-4 h-4" />
            Shape
          </Button>
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <Image className="w-4 h-4" />
            Image
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm">
          Share
        </Button>
        <Button size="sm">
          Present
        </Button>
      </div>
    </header>
  );
};
