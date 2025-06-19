
import { Slide, SlideElement } from '@/types/slide';
import PizZip from 'pizzip';
import { parseEnhancedPowerPoint } from './pptx';


// Structure to identify Marine Corps styling specifically
interface StyleTemplate {
  id: string;
  name: string;
  detection: {
    patterns: Array<RegExp | string>;
    colorSchemes?: string[];
    textPatterns?: Array<RegExp | string>;
  };
}

// Define known templates that can be detected
const styleTemplates: StyleTemplate[] = [
  {
    id: 'marine-corps',
    name: 'Marine Corps',
    detection: {
      patterns: [
        /United\s+States\s+Marine\s+Corps/i,
        /Inspector\s+General/i,
        /Intelligence\s+Oversight/i
      ],
      colorSchemes: ['#dc2626', '#ffffff'], // red and white colors
      textPatterns: [
        /United\s+States\s+Marine\s+Corps/i,
        /Inspector\s+General/i,
        /Intelligence\s+Oversight/i
      ]
    }
  }
];

// Function to detect template from slide content
const detectTemplateFromContent = (slideXML: string, textElements: ParsedSlideContent['textElements']): string | undefined => {
  // Check each template's detection patterns
  for (const template of styleTemplates) {
    // Check for text patterns in extracted text
    const textContent = textElements.map(t => t.text).join(' ');
    
    // Match against text patterns
    const hasTextMatch = template.detection.textPatterns?.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(textContent);
      }
      return textContent.includes(pattern);
    });
    
    // Match against XML patterns
    const hasXmlMatch = template.detection.patterns.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(slideXML);
      }
      return slideXML.includes(pattern);
    });
    
    if (hasTextMatch || hasXmlMatch) {
      console.log(`Detected template: ${template.name}`);
      return template.id;
    }
  }
  
  return undefined;
};

// Function to detect template from style elements even when content doesn't match
const detectTemplateFromStyle = (slideXML: string, backgroundColor?: string): string | undefined => {
  // Check for Marine Corps style characteristics
  // 1. Look for red color elements (common in Marine Corps slides)
  const hasRedElements = slideXML.includes('val="FF0000"') || slideXML.includes('val="ff0000"') || slideXML.includes('val="DC2626"');
  
  // 2. Look for layout patterns typical of Marine Corps slides
  const hasTypicalLayout = slideXML.includes('<p:sp>') && slideXML.includes('<a:prstGeom prst="rect">');
  
  // 3. Look for slide master relationship that might indicate Marine Corps template
  const hasMasterRelationship = slideXML.includes('<p:clrMapOvr><a:masterClrMapping/>');
  
  // If we have strong indicators of Marine Corps styling
  if (hasRedElements && hasTypicalLayout && hasMasterRelationship) {
    return 'marine-corps';
  }
  
  return undefined;
};

interface ParsedSlideContent {
  detectedTemplate?: string;
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
  // Extract text elements first for template detection
  const textElements = extractTextWithStyles(slideXML);
  // Detect template from content
  const detectedTemplate = detectTemplateFromContent(slideXML, textElements);
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
  
  // Add enhanced detection for slide masters and common elements
  // If we can't detect directly from content, look for layout and structural clues
  const detectedFromStyle = !detectedTemplate && detectTemplateFromStyle(
    slideXML, 
    background.backgroundColor
  );
  
  return {
    title: `Slide ${slideNumber}`,
    content: textElements.map(t => t.text).join(' '),
    textElements,
    backgroundColor: background.backgroundColor,
    detectedTemplate: detectedTemplate || detectedFromStyle,
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
      console.log('parsePowerPointFile: Parsed slide', i + 1, 'with', parsedSlide.textElements.length, 'text elements');
      slides.push(parsedSlide);
    }
    
    return slides;
  } catch (error) {
    console.error('Error parsing PowerPoint file:', error);
    return [];
  }
};

/**
 * Process uploaded files to extract slides
 * @param files Array of files from the file input
 * @returns Promise resolving to array of parsed slides
 */
export const processUploadedFiles = async (files: File[]): Promise<Slide[]> => {
  console.log('processUploadedFiles: Starting with', files.length, 'files');
  if (!files.length) return [];

  const allSlides: Slide[] = [];

  // Process each file
  for (const file of files) {
    console.log('Processing file:', file.name, file.type, file.size);
    
    try {
      const extension = file.name.toLowerCase().split('.').pop();
      
      if (extension === 'pptx') {
        // Try parsing with our enhanced PowerPoint parser first
        try {
          console.log('Attempting to use enhanced PowerPoint parser');
          const enhancedSlides = await parseEnhancedPowerPoint(file);
          console.log('Enhanced parser returned', enhancedSlides?.length || 0, 'slides');
          
          if (enhancedSlides && enhancedSlides.length > 0) {
            console.log('Enhanced parser success - slides have elements:', 
              enhancedSlides.map(s => s.elements?.length || 0));
            
            // Look for Marine Corps styling in text elements
            let marineCorpsDetected = false;
            
            for (const slide of enhancedSlides) {
              // Check text elements for Marine Corps identifiers
              for (const element of slide.elements) {
                if (element.type === 'text' && element.content) {
                  if (element.content.includes('MARINE CORPS') || 
                      element.content.includes('USMC')) {
                    marineCorpsDetected = true;
                    break;
                  }
                }
              }
              if (marineCorpsDetected) break;
            }
            
            // Apply Marine Corps styling if detected
            if (marineCorpsDetected) {
              console.log('Applying Marine Corps styling');
              enhancedSlides.forEach(slide => {
                slide.elements.forEach(element => {
                  if (element.type === 'text') {
                    // Style title elements with Marine Corps red
                    if (element.fontSize && element.fontSize >= 20) {
                      element.color = '#cc0000'; // Marine Corps red
                      element.fontWeight = 'bold';
                    }
                  }
                });
              });
            }
            
            // Add all parsed slides to our collection
            allSlides.push(...enhancedSlides);
            continue; // Skip legacy parser if enhanced parser succeeded
          }
        } catch (e) {
          console.error('Enhanced PowerPoint parser failed:', e);
          // Continue to legacy parser
        }
        
        // Legacy parser (fallback)
        console.log('Using legacy PowerPoint parser...');
        const parsedSlides = await parsePowerPointFile(file);
        
        // Track detected template for this file
        let currentFileTemplate: string | undefined;
        
        for (let i = 0; i < parsedSlides.length; i++) {
          const parsedSlide = parsedSlides[i];
          
          // If this slide has a detected template, remember it for all slides in this file
          if (parsedSlide.detectedTemplate) {
            currentFileTemplate = parsedSlide.detectedTemplate;
          } 
          // Otherwise, use the previously detected template from this file if available
          else if (currentFileTemplate) {
            parsedSlide.detectedTemplate = currentFileTemplate;
          }
          
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
              type: 'image',
              x: imageData.x,
              y: imageData.y,
              width: imageData.width,
              height: imageData.height,
              content: imageData.data
            });
          });
          
          // Apply detected template styling if found
          if (parsedSlide.detectedTemplate) {
            applyTemplateStyle(slide, parsedSlide.detectedTemplate);
          }
          
          allSlides.push(slide);
        }
      } else {
        // Fallback for other file types (ppt, odp)
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        
        const slide: Slide = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: fileName,
          content: 'Non-PPTX slide',
          backgroundColor: '#ffffff',
          elements: [
            {
              id: `text-${Date.now()}-0`,
              type: 'text',
              x: 50,
              y: 50,
              width: 700,
              height: 60,
              content: fileName,
              color: '#000000',
              backgroundColor: 'transparent',
              fontSize: 24
            },
            {
              id: `text-${Date.now()}-1`,
              type: 'text',
              x: 50,
              y: 120,
              width: 700,
              height: 40,
              content: 'Full parsing support coming soon for this file format.',
              color: '#666666',
              backgroundColor: 'transparent',
              fontSize: 16
            }
          ]
        };
        
        allSlides.push(slide);
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
      
      allSlides.push(errorSlide);
    }
  }
  
  return allSlides;
}

// Apply specific template styling to a slide
const applyTemplateStyle = (slide: Slide, templateId: string): void => {
  if (templateId === 'marine-corps') {
    // Apply Marine Corps styling
    slide.backgroundColor = 'white';
    
    // Check for existing styled elements to avoid duplication
    const hasLeftSidebar = slide.elements.some(el => el.id === 'mc-left-sidebar');
    const hasRightSidebar = slide.elements.some(el => el.id === 'mc-right-sidebar');
    const hasEmblem = slide.elements.some(el => el.id === 'mc-emblem');
    
    // Add red sidebars if they don't exist
    if (!hasLeftSidebar) {
      slide.elements.push({
        id: 'mc-left-sidebar',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 56,
        height: 600,
        backgroundColor: '#dc2626' // red-600
      });
    }
    
    if (!hasRightSidebar) {
      slide.elements.push({
        id: 'mc-right-sidebar',
        type: 'rectangle',
        x: 744, // 800 - 56
        y: 0,
        width: 56,
        height: 600,
        backgroundColor: '#dc2626' // red-600
      });
    }
    
    if (!hasEmblem) {
      slide.elements.push({
        id: 'mc-emblem',
        type: 'image',
        x: 650,
        y: 220,
        width: 100,
        height: 100,
        content: '/image1.jpg'
      });
    }
    
    // Don't duplicate Marine Corps text elements if content already includes these phrases
    const contentText = slide.elements
      .filter(el => el.type === 'text')
      .map(el => el.content || '')
      .join(' ');
      
    const hasMarineCorpsText = /United\s+States\s+Marine\s+Corps/i.test(contentText);
    const hasInspectorGeneralText = /Inspector\s+General/i.test(contentText);
    const hasIntelligenceOversightText = /Intelligence\s+Oversight/i.test(contentText);
    
    // Only add Marine Corps title if it's not already in the content
    if (!hasMarineCorpsText) {
      slide.elements.push({
        id: 'mc-title',
        type: 'text',
        x: 400,
        y: 100,
        width: 300,
        height: 30,
        content: 'United States Marine Corps',
        fontSize: 24,
        color: 'black',
        backgroundColor: 'transparent'
      });
    }
    
    // Only add Inspector General if not already in content
    if (!hasInspectorGeneralText) {
      slide.elements.push({
        id: 'mc-subtitle',
        type: 'text',
        x: 400,
        y: 140,
        width: 300,
        height: 25,
        content: 'Inspector General',
        fontSize: 20,
        color: 'black',
        backgroundColor: 'transparent'
      });
    }
    
    // Only add Intelligence Oversight if not already in content
    if (!hasIntelligenceOversightText) {
      slide.elements.push({
        id: 'mc-main-title',
        type: 'text',
        x: 400,
        y: 170,
        width: 300,
        height: 25,
        content: 'Intelligence Oversight',
        fontSize: 18,
        color: 'black',
        backgroundColor: 'transparent'
      });
    }
  }
};

