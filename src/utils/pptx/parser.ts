import PizZip from 'pizzip';
import { PPTXSlide, PPTXFill, PPTXColor, PPTXPresentation } from '../../types/pptx';
import { extractSlideElements } from './elementExtractor';
import { parseTheme } from './themeParser';
import { parseRelationships } from './relationParser';
import { calculateScaleFactor, DEFAULT_SLIDE_WIDTH_EMU, DEFAULT_SLIDE_HEIGHT_EMU, RENDER_WIDTH } from './units';

/**
 * Parses a PowerPoint file and extracts all content and styling
 * @param file The PowerPoint file to parse
 * @returns A promise that resolves to the parsed presentation
 */
export async function parsePPTX(file: File): Promise<PPTXPresentation> {
  // Read the file as an ArrayBuffer
  const buffer = await file.arrayBuffer();
  const zip = new PizZip(buffer);
  
  // Parse presentation properties (presentation.xml)
  const presentationXml = zip.file('ppt/presentation.xml')?.asText() || '';
  const presentationProps = parsePresentationProps(presentationXml);
  
  // Parse theme (theme1.xml)
  const themeXml = zip.file('ppt/theme/theme1.xml')?.asText() || '';
  const theme = parseTheme(themeXml);
  
  // Extract all relationships
  const relationshipsMap = parseAllRelationships(zip);
  
  // Parse all slides
  const slides = await parseAllSlides(
    zip, 
    relationshipsMap, 
    presentationProps.size,
    presentationProps.originalSizeEmu,
    presentationProps.scaleFactor
  );
  
  return {
    slides,
    masters: {}, // TODO: Implement master slide parsing
    layouts: {}, // TODO: Implement layout parsing
    theme,
    size: presentationProps.size,
  };
}

/**
 * Parses presentation.xml to extract size and general properties
 */
function parsePresentationProps(xml: string): { 
  size: { width: number; height: number }; 
  originalSizeEmu: { width: number; height: number };
  scaleFactor: number;
  slideIds: string[];
} {
  // Default size (standard 16:9 presentation)
  let width = DEFAULT_SLIDE_WIDTH_EMU;
  let height = DEFAULT_SLIDE_HEIGHT_EMU;
  const slideIds: string[] = [];
  
  // Extract slide size
  const sizeMatch = xml.match(/<p:sldSz[^>]*cx="([^"]*)"[^>]*cy="([^"]*)"/);  
  if (sizeMatch) {
    width = parseInt(sizeMatch[1], 10);
    height = parseInt(sizeMatch[2], 10);
  }
  
  // Extract slide ids
  const slideIdRegex = /<p:sldId[^>]*id="([^"]*)"[^>]*r:id="([^"]*)"/g;
  let match;
  while ((match = slideIdRegex.exec(xml)) !== null) {
    slideIds.push(match[2]); // Store the relationship IDs
  }
  
  // Calculate scale factor for rendering
  const scaleFactor = calculateScaleFactor(width);
  
  return { 
    size: { 
      width: RENDER_WIDTH, // Use standard render width
      height: Math.round(height * scaleFactor / 12700) // Scale height proportionally
    },
    originalSizeEmu: {
      width,
      height
    },
    scaleFactor,
    slideIds
  };
}

/**
 * Parses all relationships XML files in the PPTX
 */
function parseAllRelationships(zip: PizZip): Record<string, Record<string, string>> {
  const relationships: Record<string, Record<string, string>> = {};
  
  // Parse main presentation relationships
  const presentationRels = zip.file('ppt/_rels/presentation.xml.rels')?.asText();
  if (presentationRels) {
    relationships['presentation'] = parseRelationships(presentationRels);
  }
  
  // Find and parse all slide relationships
  Object.keys(zip.files).forEach(filePath => {
    if (filePath.startsWith('ppt/slides/_rels/') && filePath.endsWith('.xml.rels')) {
      const slideName = filePath.split('/').pop()?.replace('.rels', '') || '';
      const slideRels = zip.file(filePath)?.asText();
      if (slideRels) {
        relationships[slideName] = parseRelationships(slideRels);
      }
    }
  });
  
  return relationships;
}

/**
 * Parses all slides in the presentation
 */
async function parseAllSlides(
  zip: PizZip, 
  relationships: Record<string, Record<string, string>>,
  size: { width: number; height: number },
  originalSizeEmu: { width: number; height: number },
  scaleFactor: number
): Promise<PPTXSlide[]> {
  const slides: PPTXSlide[] = [];
  
  // Find all slide XML files
  const slideFiles = Object.keys(zip.files).filter(
    path => path.match(/^ppt\/slides\/slide[0-9]+\.xml$/)
  ).sort();
  
  // Parse each slide
  for (let i = 0; i < slideFiles.length; i++) {
    const slideXml = zip.file(slideFiles[i])?.asText();
    if (!slideXml) continue;
    
    const slideNum = parseInt(slideFiles[i].match(/slide([0-9]+)\.xml$/)?.[1] || '0', 10);
    const slideId = `slide${slideNum}.xml`;
    const slideRels = relationships[slideId] || {};
    
    // Extract all elements from the slide
    const elements = extractSlideElements(slideXml, slideRels, zip, originalSizeEmu, scaleFactor);
    
    slides.push({
      id: slideId,
      number: slideNum,
      elements,
      size,
      background: parseSlideBackground(slideXml),
    });
  }
  
  return slides;
}

/**
 * Parse slide background properties
 */
function parseSlideBackground(slideXml: string): {
  fill?: PPTXFill;
  showMasterBackground: boolean;
} {
  // Check if there's a background section
  const bgMatch = slideXml.match(/<p:bg[^>]*>([\s\S]*?)<\/p:bg>/);
  if (!bgMatch) {
    return { showMasterBackground: true };
  }
  
  const bgContent = bgMatch[1];
  
  // Check for background fill
  const bgFillMatch = bgContent.match(/<p:bgPr>([\s\S]*?)<\/p:bgPr>/);
  if (!bgFillMatch) {
    return { showMasterBackground: true };
  }
  
  const bgProps = bgFillMatch[1];
  
  // Extract solid fill
  const solidFillMatch = bgProps.match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/);
  if (solidFillMatch) {
    const colorContent = solidFillMatch[1];
    
    // Extract color from content
    const srgbMatch = colorContent.match(/<a:srgbClr val="([A-Fa-f0-9]{6})"\/?>/);
    if (srgbMatch) {
      return {
        showMasterBackground: false,
        fill: { 
          type: 'solid' as const, 
          color: { type: 'rgb' as const, value: srgbMatch[1] } 
        }
      };
    }
    
    // Look for scheme color
    const schemeColorMatch = colorContent.match(/<a:schemeClr val="([^"]*)"\/?>/);
    if (schemeColorMatch) {
      return {
        showMasterBackground: false,
        fill: {
          type: 'solid' as const,
          color: { type: 'scheme' as const, value: schemeColorMatch[1] }
        }
      };
    }
  }
  
  // Extract gradient fill
  const gradFillMatch = bgProps.match(/<a:gradFill[^>]*>([\s\S]*?)<\/a:gradFill>/);
  if (gradFillMatch) {
    const gradContent = gradFillMatch[1];
    
    // Extract gradient stops
    const stops: {position: number; color: PPTXColor}[] = [];
    
    // Find all gradient stops
    const stopRegex = /<a:gs pos="([0-9]+)">([\s\S]*?)<\/a:gs>/g;
    let stopMatch;
    while ((stopMatch = stopRegex.exec(gradContent)) !== null) {
      const position = parseInt(stopMatch[1]) / 1000; // Convert from thousandths to percentage
      const stopContent = stopMatch[2];
      
      // Extract color from stop
      const srgbStopMatch = stopContent.match(/<a:srgbClr val="([A-Fa-f0-9]{6})"\/?>/);
      if (srgbStopMatch) {
        stops.push({
          position,
          color: { type: 'rgb', value: srgbStopMatch[1] }
        });
      } else {
        const schemeStopMatch = stopContent.match(/<a:schemeClr val="([^"]*)"\/?>/);
        if (schemeStopMatch) {
          stops.push({
            position,
            color: { type: 'scheme', value: schemeStopMatch[1] }
          });
        }
      }
    }
    
    if (stops.length >= 2) {
      return {
        showMasterBackground: false,
        fill: {
          type: 'gradient',
          stops: stops,
          angle: 90 // Default to vertical gradient if not specified
        }
      };
    }
  }
  
  // Check for background image (blip fill)
  const blipFillMatch = bgProps.match(/<a:blipFill>([\s\S]*?)<\/a:blipFill>/);
  if (blipFillMatch) {
    const blipContent = blipFillMatch[1];
    const rIdMatch = blipContent.match(/r:embed="([^"]*)"/);
    if (rIdMatch) {
      return {
        showMasterBackground: false,
        fill: {
          type: 'blip',
          blip: rIdMatch[1], // This is the relationship ID for the image
          stretch: true
        }
      };
    }
  }
  
  // Default if we couldn't parse anything specific
  return { 
    showMasterBackground: false,
    fill: { 
      type: 'solid', 
      color: { type: 'rgb', value: '000080' } // Navy blue as default for unrecognized backgrounds
    }
  };
}
