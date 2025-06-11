
import { Slide } from '@/types/slide';
import PizZip from 'pizzip';

interface ParsedSlideContent {
  title: string;
  content: string;
  textElements: string[];
}

const extractTextFromXML = (xml: string): string[] => {
  const textElements: string[] = [];
  
  // Extract text from PowerPoint XML structure
  const textRegex = /<a:t[^>]*>([^<]*)<\/a:t>/g;
  let match;
  
  while ((match = textRegex.exec(xml)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 0) {
      textElements.push(text);
    }
  }
  
  return textElements;
};

const parseSlideXML = (slideXML: string, slideNumber: number): ParsedSlideContent => {
  const textElements = extractTextFromXML(slideXML);
  
  // First text element is typically the title
  const title = textElements[0] || `Slide ${slideNumber}`;
  
  // Remaining elements are content
  const content = textElements.slice(1).join('\n') || 'No content extracted';
  
  return {
    title,
    content,
    textElements
  };
};

const parsePowerPointFile = async (file: File): Promise<ParsedSlideContent[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = new PizZip(arrayBuffer);
    
    const slides: ParsedSlideContent[] = [];
    
    // Get all slide files from the PowerPoint structure
    const slideFiles = Object.keys(zip.files).filter(fileName => 
      fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml')
    );
    
    // Sort slides by number
    slideFiles.sort((a, b) => {
      const aNum = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || '0');
      const bNum = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || '0');
      return aNum - bNum;
    });
    
    for (let i = 0; i < slideFiles.length; i++) {
      const slideFile = slideFiles[i];
      const slideXML = zip.files[slideFile].asText();
      const parsedSlide = parseSlideXML(slideXML, i + 1);
      slides.push(parsedSlide);
    }
    
    return slides;
  } catch (error) {
    console.error('Error parsing PowerPoint file:', error);
    return [];
  }
};

export const processUploadedFiles = async (files: File[]): Promise<Slide[]> => {
  const newSlides: Slide[] = [];

  for (const file of files) {
    try {
      console.log(`Processing file: ${file.name}`);
      
      const extension = file.name.toLowerCase().split('.').pop();
      
      if (extension === 'pptx') {
        // Parse PowerPoint file
        const parsedSlides = await parsePowerPointFile(file);
        
        for (let i = 0; i < parsedSlides.length; i++) {
          const parsedSlide = parsedSlides[i];
          
          const slide: Slide = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i}`,
            title: parsedSlide.title,
            content: parsedSlide.content,
            backgroundColor: '#ffffff',
            elements: []
          };

          // Create text elements for each extracted text piece
          parsedSlide.textElements.forEach((text, index) => {
            if (text.trim()) {
              slide.elements.push({
                id: `text-${Date.now()}-${index}`,
                type: 'text',
                x: 50,
                y: 100 + (index * 80),
                width: 700,
                height: 60,
                content: text,
                color: '#000000',
                backgroundColor: 'transparent',
                fontSize: index === 0 ? 24 : 16 // First element (title) is larger
              });
            }
          });

          newSlides.push(slide);
        }
      } else {
        // Fallback for other file types (ppt, odp)
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        
        const slide: Slide = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: fileName,
          content: `Content from ${file.name} (parsing not yet supported for this format)`,
          backgroundColor: '#ffffff',
          elements: [
            {
              id: `text-${Date.now()}`,
              type: 'text',
              x: 50,
              y: 100,
              width: 700,
              height: 60,
              content: `File: ${file.name}`,
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
              content: 'Full parsing support coming soon for this file format.',
              color: '#666666',
              backgroundColor: 'transparent',
              fontSize: 16
            }
          ]
        };

        newSlides.push(slide);
      }
    } catch (error) {
      console.error('Error processing file:', file.name, error);
      
      // Create error slide
      const errorSlide: Slide = {
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: `Error: ${file.name}`,
        content: 'Failed to process this file',
        backgroundColor: '#ffffff',
        elements: [
          {
            id: `error-text-${Date.now()}`,
            type: 'text',
            x: 50,
            y: 100,
            width: 700,
            height: 60,
            content: `Error processing: ${file.name}`,
            color: '#dc2626',
            backgroundColor: 'transparent',
            fontSize: 20
          }
        ]
      };
      
      newSlides.push(errorSlide);
    }
  }

  return newSlides;
};
