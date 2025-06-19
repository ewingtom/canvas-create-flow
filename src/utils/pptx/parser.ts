import PizZip from 'pizzip';
import { PPTXPresentation, PPTXSlide } from '../../types/pptx';
import { extractSlideElements } from './elementExtractor';
import { parseTheme } from './themeParser';
import { parseRelationships } from './relationParser';

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
  const slides = await parseAllSlides(zip, relationshipsMap, presentationProps.size);
  
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
  slideIds: string[];
} {
  // Default size (standard 4:3 presentation)
  let width = 9144000;
  let height = 6858000;
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
  
  return { 
    size: { 
      width: width / 914400, // Convert to inches (then to pixels in renderer)
      height: height / 914400 
    },
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
  size: { width: number; height: number }
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
    const elements = extractSlideElements(slideXml, slideRels, zip);
    
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
function parseSlideBackground(slideXml: string) {
  // For now, just check if there's a background fill
  const hasBackground = slideXml.includes('<p:bg>');
  
  if (!hasBackground) {
    return { showMasterBackground: true };
  }
  
  // TODO: Extract complex background properties
  return {
    showMasterBackground: false,
    fill: { 
      type: 'solid', 
      color: { type: 'rgb', value: '#FFFFFF' } 
    }
  };
}
