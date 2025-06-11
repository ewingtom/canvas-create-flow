
import { Slide } from '@/types/slide';

export const processUploadedFiles = async (files: File[]): Promise<Slide[]> => {
  const newSlides: Slide[] = [];

  for (const file of files) {
    try {
      // For now, we'll create placeholder slides based on the file name
      // In a real implementation, you would parse the actual file content
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      
      // Create a single slide for each uploaded file
      const slide: Slide = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: fileName,
        content: `Content from ${file.name}`,
        backgroundColor: '#ffffff',
        elements: [
          {
            id: `text-${Date.now()}`,
            type: 'text',
            x: 50,
            y: 100,
            width: 700,
            height: 60,
            content: `Slide imported from ${file.name}`,
            color: '#000000',
            backgroundColor: 'transparent',
            fontSize: 24
          },
          {
            id: `subtitle-${Date.now()}`,
            type: 'text',
            x: 50,
            y: 200,
            width: 700,
            height: 40,
            content: 'This is a placeholder for the actual slide content that would be extracted from the uploaded file.',
            color: '#666666',
            backgroundColor: 'transparent',
            fontSize: 16
          }
        ]
      };

      newSlides.push(slide);
    } catch (error) {
      console.error('Error processing file:', file.name, error);
    }
  }

  return newSlides;
};
