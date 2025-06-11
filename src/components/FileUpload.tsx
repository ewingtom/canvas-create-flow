
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface FileUploadProps {
  onFilesUploaded: (files: File[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesUploaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;

    // Filter for supported file types
    const supportedFiles = files.filter(file => {
      const extension = file.name.toLowerCase().split('.').pop();
      return ['ppt', 'pptx', 'odp'].includes(extension || '');
    });

    if (supportedFiles.length === 0) {
      toast({
        title: "Unsupported file type",
        description: "Please upload PowerPoint (.ppt, .pptx) or OpenDocument (.odp) files.",
        variant: "destructive"
      });
      return;
    }

    if (supportedFiles.length !== files.length) {
      toast({
        title: "Some files skipped",
        description: `${files.length - supportedFiles.length} unsupported files were skipped.`,
      });
    }

    onFilesUploaded(supportedFiles);
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".ppt,.pptx,.odp"
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleButtonClick}
        className="flex items-center gap-2"
      >
        <Upload className="w-4 h-4" />
        Upload Slides
      </Button>
    </>
  );
};
