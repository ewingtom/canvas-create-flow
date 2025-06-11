
import { Slide, SlideElement } from '@/types/slide';
import PizZip from 'pizzip';

interface ParsedSlideContent {
  title: string;
  content: string;
  textElements: Array<{
    text: string;
    fontSize?: number;
    color?: string;
    fontWeight?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }>;
  backgroundColor?: string;
  backgroundImage?: string;
  images: Array<{
    id: string;
    data: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

const extractTextWithStyles = (xml: string): ParsedSlideContent['textElements'] => {
  const textElements: ParsedSlideContent['textElements'] = [];
  
  // Extract text runs with style information
  const textRunRegex = /<a:r[^>]*>(.*?)<\/a:r>/gs;
  let match;
  
  while ((match = textRunRegex.exec(xml)) !== null) {
    const runContent = match[1];
    
    // Extract text content
    const textMatch = runContent.match(/<a:t[^>]*>([^<]*)<\/a:t>/);
    if (!textMatch || !textMatch[1].trim()) continue;
    
    const text = textMatch[1].trim();
    
    // Extract font size
    let fontSize = 16;
    const fontSizeMatch = runContent.match(/sz="(\d+)"/);
    if (fontSizeMatch) {
      fontSize = parseInt(fontSizeMatch[1]) / 100; // PowerPoint uses points * 100
    }
    
    // Extract color
    let color = '#000000';
    const colorMatch = runContent.match(/<a:solidFill>.*?<a:srgbClr val="([^"]+)".*?<\/a:solidFill>/s);
    if (colorMatch) {
      color = '#' + colorMatch[1];
    }
    
    // Extract font weight
    let fontWeight = 'normal';
    if (runContent.includes('<a:b val="1"/>') || runContent.includes('<a:b/>')) {
      fontWeight = 'bold';
    }
    
    textElements.push({
      text,
      fontSize,
      color,
      fontWeight
    });
  }
  
  return textElements;
};

const extractPositioning = (xml: string) => {
  const positions: Array<{ x: number; y: number; width: number; height: number }> = [];
  
  // Extract shape positioning
  const shapeRegex = /<p:sp[^>]*>(.*?)<\/p:sp>/gs;
  let match;
  
  while ((match = shapeRegex.exec(xml)) !== null) {
    const shapeContent = match[1];
    
    // Extract transform information
    const transformMatch = shapeContent.match(/<a:xfrm[^>]*>(.*?)<\/a:xfrm>/s);
    if (transformMatch) {
      const transform = transformMatch[1];
      
      // Extract offset (position)
      const offsetMatch = transform.match(/<a:off x="(\d+)" y="(\d+)"/);
      // Extract extent (size)
      const extentMatch = transform.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
      
      if (offsetMatch && extentMatch) {
        positions.push({
          x: parseInt(offsetMatch[1]) / 9525, // Convert EMU to pixels (approximate)
          y: parseInt(offsetMatch[2]) / 9525,
          width: parseInt(extentMatch[1]) / 9525,
          height: parseInt(extentMatch[2]) / 9525
        });
      }
    }
  }
  
  return positions;
};

const extractBackgroundInfo = (xml: string): { backgroundColor?: string; backgroundImage?: string } => {
  let backgroundColor = '#ffffff';
  let backgroundImage;
  
  // Extract solid fill background
  const solidFillMatch = xml.match(/<p:bg>.*?<a:solidFill>.*?<a:srgbClr val="([^"]+)".*?<\/a:solidFill>.*?<\/p:bg>/s);
  if (solidFillMatch) {
    backgroundColor = '#' + solidFillMatch[1];
  }
  
  // Extract gradient or pattern fills
  const gradientMatch = xml.match(/<p:bg>.*?<a:gradFill[^>]*>(.*?)<\/a:gradFill>.*?<\/p:bg>/s);
  if (gradientMatch) {
    // For gradients, we'll use the first color as a fallback
    const firstColorMatch = gradientMatch[1].match(/<a:srgbClr val="([^"]+)"/);
    if (firstColorMatch) {
      backgroundColor = '#' + firstColorMatch[1];
    }
  }
  
  return { backgroundColor, backgroundImage };
};

const extractImages = async (zip: PizZip, slideXML: string): Promise<ParsedSlideContent['images']> => {
  const images: ParsedSlideContent['images'] = [];
  
  // Find image references in the slide
  const imageRegex = /<a:blip r:embed="([^"]+)"/g;
  let match;
  
  while ((match = imageRegex.exec(slideXML)) !== null) {
    const relationId = match[1];
    
    // Get the slide relationships to find the actual image file
    const slideNumber = slideXML.match(/slide(\d+)/)?.[1] || '1';
    const relsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
    
    if (zip.files[relsPath]) {
      const relsXML = zip.files[relsPath].asText();
      const relationMatch = relsXML.match(new RegExp(`<Relationship Id="${relationId}"[^>]*Target="([^"]+)"`));
      
      if (relationMatch) {
        const imagePath = `ppt/slides/${relationMatch[1]}`;
        
        if (zip.files[imagePath]) {
          try {
            const imageData = zip.files[imagePath].asUint8Array();
            const base64 = btoa(String.fromCharCode(...imageData));
            const mimeType = imagePath.includes('.png') ? 'image/png' : 'image/jpeg';
            
            images.push({
              id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              data: `data:${mimeType};base64,${base64}`,
              x: 50, // Default positioning, will be updated with actual coordinates
              y: 50,
              width: 200,
              height: 150
            });
          } catch (error) {
            console.error('Error processing image:', error);
          }
        }
      }
    }
  }
  
  return images;
};

const parseSlideXML = async (slideXML: string, slideNumber: number, zip: PizZip): Promise<ParsedSlideContent> => {
  const textElements = extractTextWithStyles(slideXML);
  const positions = extractPositioning(slideXML);
  const background = extractBackgroundInfo(slideXML);
  const images = await extractImages(zip, slideXML);
  
  // Apply positioning to text elements
  textElements.forEach((element, index) => {
    if (positions[index]) {
      element.x = Math.max(0, positions[index].x);
      element.y = Math.max(0, positions[index].y);
      element.width = Math.min(800, positions[index].width);
      element.height = Math.min(600, positions[index].height);
    }
  });
  
  // First text element is typically the title
  const title = textElements[0]?.text || `Slide ${slideNumber}`;
  
  // Remaining elements are content
  const content = textElements.slice(1).map(el => el.text).join('\n') || 'No content extracted';
  
  return {
    title,
    content,
    textElements,
    backgroundColor: background.backgroundColor,
    backgroundImage: background.backgroundImage,
    images
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
      const parsedSlide = await parseSlideXML(slideXML, i + 1, zip);
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
            backgroundColor: parsedSlide.backgroundColor || '#ffffff',
            elements: []
          };

          // Create text elements with extracted styles and positioning
          parsedSlide.textElements.forEach((textElement, index) => {
            if (textElement.text.trim()) {
              slide.elements.push({
                id: `text-${Date.now()}-${index}`,
                type: 'text',
                x: textElement.x || 50,
                y: textElement.y || (100 + (index * 80)),
                width: textElement.width || 700,
                height: textElement.height || 60,
                content: textElement.text,
                color: textElement.color || '#000000',
                backgroundColor: 'transparent',
                fontSize: textElement.fontSize || (index === 0 ? 24 : 16)
              });
            }
          });

          // Add image elements
          parsedSlide.images.forEach((imageData) => {
            slide.elements.push({
              id: imageData.id,
              type: 'image' as any, // We'll need to extend the SlideElement type
              x: imageData.x,
              y: imageData.y,
              width: imageData.width,
              height: imageData.height,
              content: imageData.data,
              color: '#000000',
              backgroundColor: 'transparent'
            });
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
