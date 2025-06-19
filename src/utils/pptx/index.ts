import { parsePPTX } from './parser';
import { PPTXElement, PPTXPresentation, PPTXSlide } from '../../types/pptx';
import { Slide, SlideElement } from '../../types/slide';

/**
 * Main entry point for parsing PowerPoint files using the enhanced parser
 * @param file The PowerPoint file to parse
 * @returns A promise that resolves to an array of Slides ready for the application
 */
export async function parseEnhancedPowerPoint(file: File): Promise<Slide[]> {
  try {
    console.log('Enhanced parser: Starting to parse PowerPoint file:', file.name);
    
    // Parse the PowerPoint file using our enhanced parser
    const presentation = await parsePPTX(file);
    
    console.log('Enhanced parser: Parsed presentation:', {
      slideCount: presentation.slides.length,
      size: presentation.size,
      theme: presentation.theme ? 'Theme loaded' : 'No theme found'
    });
    
    // Log slide content for debugging
    presentation.slides.forEach((slide, idx) => {
      console.log(`Enhanced parser: Slide ${idx + 1} contents:`, {
        number: slide.number,
        elementCount: slide.elements.length,
        elementTypes: slide.elements.map(e => e.type)
      });
    });
    
    // Convert the parsed PPTX slides to application slide format
    const convertedSlides = convertPresentationToSlides(presentation);
    
    console.log('Enhanced parser: Converted slides:', {
      slideCount: convertedSlides.length,
      slideDetails: convertedSlides.map(slide => ({
        id: slide.id,
        title: slide.title,
        elementCount: slide.elements.length,
        elementTypes: slide.elements.map(e => e.type)
      }))
    });
    
    return convertedSlides;
  } catch (error) {
    console.error('Error parsing PowerPoint file:', error);
    return [];
  }
}

/**
 * Converts a parsed PPTX presentation to application slides
 */
function convertPresentationToSlides(presentation: PPTXPresentation): Slide[] {
  return presentation.slides.map((pptxSlide) => {
    try {
      console.log('Converting slide:', pptxSlide.number, 'with elements:', pptxSlide.elements?.length || 0);
      
      // Generate a unique ID for the slide
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Extract text content for search/preview
      const content = extractTextContent(pptxSlide);
      
      // Convert PPTX elements to application slide elements
      let elements = convertElements(pptxSlide.elements || []);
      
      console.log('Converted elements:', elements.length);
      
      // Ensure each slide has at least some default elements for visibility
      if (elements.length === 0) {
        console.log('Adding default elements to slide', pptxSlide.number);
        elements = createDefaultSlideElements(pptxSlide.number, content);
      }
      
      // Extract background
      const backgroundColor = extractBackgroundColor(pptxSlide);
      
      return {
        id,
        title: `Slide ${pptxSlide.number}`,
        content,
        elements,
        backgroundColor,
      };
    } catch (error) {
      console.error('Error converting slide:', error);
      // Create a slide with error information
      const errorSlide = {
        id: `error-${Date.now()}`,
        title: `Error: Slide ${pptxSlide.number}`,
        content: 'Error processing slide',
        elements: createErrorSlideElements(),
        backgroundColor: '#ffffff'
      };
      return errorSlide;
    }
  });
}

/**
 * Create default elements for a slide with no detected elements
 */
function createDefaultSlideElements(slideNumber: number, content: string): SlideElement[] {
  const elements: SlideElement[] = [];
  
  // Add a title element
  elements.push({
    id: `title-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    type: 'text',
    x: 50,
    y: 50,
    width: 600,
    height: 60,
    content: `Slide ${slideNumber}`,
    color: '#000000',
    backgroundColor: 'transparent',
    fontSize: 32,
    fontWeight: 'bold'
  });
  
  // Add content if available
  if (content && content.trim().length > 0) {
    elements.push({
      id: `content-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'text',
      x: 50,
      y: 120,
      width: 600,
      height: 300,
      content: content,
      color: '#333333',
      backgroundColor: 'transparent',
      fontSize: 16
    });
  } else {
    // Add placeholder text if no content
    elements.push({
      id: `placeholder-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'text',
      x: 50, 
      y: 120,
      width: 600,
      height: 50,
      content: 'Content could not be extracted from this slide',
      color: '#666666',
      backgroundColor: 'transparent',
      fontSize: 16
    });
  }
  
  // Add a rectangle for visual interest
  elements.push({
    id: `rect-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    type: 'rectangle',
    x: 50,
    y: 200,
    width: 150,
    height: 8,
    backgroundColor: '#3b82f6',
    color: 'transparent'
  });
  
  return elements;
}

/**
 * Create elements for an error slide
 */
function createErrorSlideElements(): SlideElement[] {
  return [
    {
      id: `error-title-${Date.now()}`,
      type: 'text',
      x: 50,
      y: 50,
      width: 600,
      height: 60,
      content: 'Error Processing Slide',
      color: '#dc2626', // Red text for error
      backgroundColor: 'transparent',
      fontSize: 32,
      fontWeight: 'bold'
    },
    {
      id: `error-desc-${Date.now()}`,
      type: 'text',
      x: 50,
      y: 120,
      width: 600,
      height: 100,
      content: 'There was an error processing this slide. The content could not be properly extracted.',
      color: '#666666',
      backgroundColor: 'transparent',
      fontSize: 16
    },
    {
      id: `error-rect-${Date.now()}`,
      type: 'rectangle',
      x: 50,
      y: 200,
      width: 150,
      height: 8,
      backgroundColor: '#dc2626',
      color: 'transparent'
    }
  ];
}

/**
 * Extract all text content from a slide for search/preview
 */
function extractTextContent(slide: PPTXSlide): string {
  let content = '';
  
  // Extract text from all text elements
  slide.elements.forEach(element => {
    if (element.type === 'text') {
      content += element.paragraphs.map(p => p.text || p.runs.map(r => r.text).join('')).join('\n') + '\n';
    } else if (element.type === 'shape' && element.textContent) {
      content += element.textContent.paragraphs.map(p => p.text || p.runs.map(r => r.text).join('')).join('\n') + '\n';
    } else if (element.type === 'group') {
      // Recursively extract text from group elements
      element.children.forEach(child => {
        if (child.type === 'text') {
          content += child.paragraphs.map(p => p.text || p.runs.map(r => r.text).join('')).join('\n') + '\n';
        } else if (child.type === 'shape' && 'textContent' in child && child.textContent) {
          content += child.textContent.paragraphs.map(p => p.text || p.runs.map(r => r.text).join('')).join('\n') + '\n';
        }
      });
    }
  });
  
  return content.trim();
}

/**
 * Convert background information to a CSS color
 */
function extractBackgroundColor(slide: PPTXSlide): string {
  try {
    // Default white background
    if (!slide.background || !slide.background.fill) {
      return '#FFFFFF';
    }
    
    const fill = slide.background.fill;
    
    if (fill.type === 'solid' && fill.color?.type === 'rgb') {
      return fill.color.value;
    }
    
    // For now, default to white for other fill types
    return '#FFFFFF';
  } catch (error) {
    console.warn('Error extracting background color:', error);
    return '#FFFFFF';
  }
}

/**
 * Convert PPTX elements to application slide elements
 */
function convertElements(pptxElements: PPTXElement[]): SlideElement[] {
  const elements: SlideElement[] = [];
  
  if (!pptxElements || pptxElements.length === 0) {
    console.warn('No elements to convert');
    return elements;
  }
  
  pptxElements.forEach(element => {
    try {
      console.log('Converting element:', element.type, element.id);
      
      switch (element.type) {
        case 'text':
          elements.push(convertTextElement(element as any));
          break;
        
        case 'shape':
          const shapeElement = element as any; // Type as any to access textContent
          elements.push(convertShapeElement(element));
          if (shapeElement.textContent) {
            elements.push(convertTextElement(shapeElement.textContent));
          }
          break;
        
        case 'image':
          elements.push(convertImageElement(element));
          break;
        
        case 'group':
          // For groups, add each child element individually
          const groupElement = element as any; // Type as any to access children
          if (groupElement.children && Array.isArray(groupElement.children)) {
            groupElement.children.forEach((child: any) => {
              if (child.type === 'text') {
                elements.push(convertTextElement(child));
              } else if (child.type === 'shape') {
                elements.push(convertShapeElement(child));
                if (child.textContent) {
                  elements.push(convertTextElement(child.textContent));
                }
              } else if (child.type === 'image') {
                elements.push(convertImageElement(child));
              }
            });
          }
          break;
        
        // Additional element types can be added here as needed
        default:
          console.log('Skipping unknown element type:', element.type);
          break;
      }
    } catch (error) {
      console.error('Error converting element:', error, element);
    }
  });
  
  return elements;
}

/**
 * Convert a PPTX text element to application text element
 */
function convertTextElement(element: any): SlideElement {
  // Generate a unique ID
  const id = `text-${Date.now()}-${Math.random().toString(36).substr(2, 11)}`;
  
  try {
    // Extract text content
    let extractedText = '';
    
    if (element.paragraphs && Array.isArray(element.paragraphs)) {
      extractedText = element.paragraphs
        .map((p: any) => {
          if (p.text) return p.text;
          if (p.runs && Array.isArray(p.runs)) {
            return p.runs.map((r: any) => r.text || '').join('');
          }
          return '';
        })
        .join('\n');
    }
    
    // Default properties
    let fontSize = 12;
    let fontFamily = 'Arial';
    let fontColor = '#000000';
    let fontWeight = 'normal';
    let fontStyle = 'normal';
    let textDecoration = 'none';
    let textAlign = 'left';
    
    // Extract the first run to determine basic styling
    const firstParagraph = element.paragraphs?.[0];
    const firstRun = firstParagraph?.runs?.[0];
    
    // Extract styling from the first run if available
    if (firstRun) {
      fontSize = firstRun.size || fontSize;
      fontFamily = firstRun.font || fontFamily;
      fontWeight = firstRun.bold ? 'bold' : 'normal';
      fontStyle = firstRun.italic ? 'italic' : 'normal';
      textDecoration = firstRun.underline ? 'underline' : 'none';
      
      // Extract color
      if (firstRun.color) {
        if (firstRun.color.type === 'rgb') {
          fontColor = firstRun.color.value;
        } else if (firstRun.color.type === 'scheme') {
          // Map scheme colors to values - this is a simple mapping
          const schemeColorMap: Record<string, string> = {
            tx1: '#000000',
            tx2: '#FFFFFF',
            bg1: '#FFFFFF',
            bg2: '#000000',
            accent1: '#4472C4',
            accent2: '#ED7D31',
            accent3: '#A5A5A5',
            accent4: '#FFC000',
            accent5: '#5B9BD5',
            accent6: '#70AD47',
          };
          fontColor = schemeColorMap[firstRun.color.value] || '#000000';
        }
      }
    }
    
    // Extract alignment from paragraph
    if (firstParagraph?.alignment) {
      textAlign = firstParagraph.alignment;
    }
    
    console.log('Created text element with content:', extractedText.substring(0, 50));
    
    return {
      id,
      type: 'text',
      x: element.x || 50,
      y: element.y || 50,
      width: element.width || 200,
      height: element.height || 50,
      content: extractedText, // Use content instead of text
      color: fontColor,
      backgroundColor: 'transparent',
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle,
      textDecoration,
      textAlign,
      rotation: element.rotation || 0,
    };
  } catch (error) {
    console.error('Error in convertTextElement:', error);
    return {
      id,
      type: 'text',
      x: 50,
      y: 50,
      width: 200,
      height: 50,
      content: 'Error extracting text',
      color: '#000000',
      backgroundColor: 'transparent'
    };
  }
}

/**
 * Convert a PPTX shape element to application shape element
 */
function convertShapeElement(element: any): SlideElement {
  // Generate a unique ID
  const id = `shape-${Date.now()}-${Math.random().toString(36).substr(2, 11)}`;
  
  try {
    // Extract shape properties
    const shapeType = element.shapeType || 'rect';
    
    // Extract fill
    let fill = 'transparent';
    if (element.fill) {
      if (element.fill.type === 'solid' && element.fill.color?.type === 'rgb') {
        fill = element.fill.color.value;
      } else if (element.fill.type === 'pattern') {
        // For now, use a default fill for patterns
        fill = '#f0f0f0';
      } else if (element.fill.type === 'gradient') {
        // For now, use the first stop color for gradients
        const firstStop = element.fill.stops?.[0];
        if (firstStop?.color?.type === 'rgb') {
          fill = firstStop.color.value;
        }
      }
    }
    
    // Extract stroke properties
    let strokeColor = 'transparent';
    let strokeWidth = 0;
    
    if (element.outline) {
      if (element.outline.color?.type === 'rgb') {
        strokeColor = element.outline.color.value;
      }
      strokeWidth = element.outline.width || 0;
    }
    
    console.log('Created shape element:', shapeType);
    
    return {
      id,
      type: shapeType === 'ellipse' ? 'ellipse' : 'rectangle', // Map to available shape types
      x: element.x || 50,
      y: element.y || 50,
      width: element.width || 100,
      height: element.height || 100,
      backgroundColor: fill,
      fill: fill,
      strokeColor: strokeColor,
      strokeWidth: strokeWidth,
      rotation: element.rotation || 0,
    };
  } catch (error) {
    console.error('Error in convertShapeElement:', error);
    return {
      id,
      type: 'rectangle',
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      backgroundColor: '#f0f0f0',
      fill: '#f0f0f0',
      strokeColor: 'transparent',
      strokeWidth: 0
    };
  }
}

/**
 * Map PowerPoint shape types to application shape types
 */
function mapShapeType(pptxShapeType: string): 'rectangle' | 'ellipse' | 'line' {
  // Map common PowerPoint shape types to our supported types
  switch (pptxShapeType) {
    case 'rect':
    case 'roundRect':
    case 'snip1Rect':
    case 'snip2SameRect':
    case 'round1Rect':
    case 'round2SameRect':
    case 'square':
      return 'rectangle';
    
    case 'ellipse':
    case 'oval':
    case 'circle':
      return 'ellipse';
    
    case 'line':
    case 'straightConnector1':
    case 'bentConnector2':
    case 'bentConnector3':
    case 'curvedConnector2':
    case 'curvedConnector3':
      return 'line';
    
    default:
      // Default to rectangle for unsupported shapes
      return 'rectangle';
  }
}

/**
 * Convert a PPTX image element to application image element
 */
function convertImageElement(element: any): SlideElement {
  // Generate a unique ID
  const id = `image-${Date.now()}-${Math.random().toString(36).substr(2, 11)}`;
  
  try {
    // Extract image properties
    const src = element.src || '';
    
    if (!src) {
      console.warn('Image element missing source data');
    } else {
      console.log(`Created image element with source data (${src.length} chars)`);
      // Log just the beginning of the data URL to avoid filling the console
      if (src.startsWith('data:')) {
        console.log('Data URL type:', src.substring(0, 30) + '...');
      } else {
        console.log('Image source is not a data URL:', src);
      }
    }
    
    // Create slide element with both src and content properties to support both rendering mechanisms
    return {
      id,
      type: 'image',
      x: element.x || 50,
      y: element.y || 50,
      width: element.width || 200,
      height: element.height || 150,
      src: src,     // Modern property expected by the image extractor
      content: src, // Legacy property used by some renderers
      opacity: element.opacity || 1,
      rotation: element.rotation || 0,
    };
  } catch (error) {
    console.error('Error in convertImageElement:', error);
    return {
      id,
      type: 'image',
      x: 50,
      y: 50,
      width: 200,
      height: 150,
      src: '',
      content: '', // Add content field for legacy renderers
      opacity: 1
    };
  }
}
