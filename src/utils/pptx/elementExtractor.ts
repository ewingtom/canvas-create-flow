import PizZip from 'pizzip';
import { PPTXElement } from '../../types/pptx';
import { extractShape } from './shapeExtractor';
import { extractImage } from './imageExtractor';
import { createImageDataUrl } from './imageExtractor';

/**
 * Extracts all elements from a slide's XML content
 * @param slideXml The slide XML content
 * @param slideRels The slide's relationships
 * @param zip The PPTX zip file
 * @returns Array of parsed slide elements
 */
export function extractSlideElements(
  slideXml: string,
  slideRels: Record<string, string>,
  zip: PizZip
): PPTXElement[] {
  const elements: PPTXElement[] = [];
  
  try {
    console.log('Extracting elements from slide XML...');
    
    // Extract the shape tree (the root container of all slide elements)
    const spTreeMatch = slideXml.match(/<p:spTree>([\s\S]*?)<\/p:spTree>/);
    if (!spTreeMatch) {
      console.warn('No spTree element found in the slide XML');
      return elements;
    }
    
    const spTreeContent = spTreeMatch[1];
    
    console.log('spTreeContent length:', spTreeContent.length);
    console.log('XML sample for debugging:', spTreeContent.substring(0, 200) + '...');
    
    // Check for element presence
    const hasShapes = spTreeContent.includes('<p:sp');
    const hasPictures = spTreeContent.includes('<p:pic');
    const hasGroups = spTreeContent.includes('<p:grpSp');
    
    console.log('Element detection:', { hasShapes, hasPictures, hasGroups });
    
    // Process all shapes (p:sp)
    extractShapeElements(slideXml, spTreeContent, slideRels, zip, elements);
    
    // Process all pictures (p:pic)
    console.log('Searching for picture elements in slide');
    extractPictureElements(slideXml, spTreeContent, slideRels, zip, elements);
    
    // Process all group shapes (p:grpSp)
    extractGroupElements(slideXml, spTreeContent, slideRels, zip, elements);
    
    // Process connector shapes (p:cxnSp)
    // TODO: Implement connector extraction
    
    // Process graphic frames (charts, tables, etc.) (p:graphicFrame)
    // TODO: Implement graphic frame extraction
    
    // Process OLE objects (p:oleObj)
    // TODO: Implement OLE object extraction
    
    // Sort elements by z-index to maintain drawing order
    elements.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    
    console.log(`Total elements extracted: ${elements.length}`);
    return elements;
  } catch (error) {
    console.error('Error extracting slide elements:', error);
    return elements;
  }
}

/**
 * Extract shape elements from the slide
 */
function extractShapeElements(
  slideXml: string,
  spTreeContent: string,
  slideRels: Record<string, string>,
  zip: PizZip,
  elements: PPTXElement[]
): void {
  // Find all shape nodes
  const shapeRegex = /<p:sp>([\s\S]*?)<\/p:sp>/g;
  let match;
  let shapeCount = 0;
  
  while ((match = shapeRegex.exec(spTreeContent)) !== null) {
    shapeCount++;
    const shapeNode = match[0];
    console.log(`Processing shape ${shapeCount}`);
    const shape = extractShape(slideXml, shapeNode, slideRels, zip);
    
    if (shape) {
      console.log(`Added shape: ${shape.type}`);
      elements.push(shape);
    }
  }
  
  console.log(`Found ${shapeCount} shapes in slide`);
  if (shapeCount === 0) {
    // Try a simpler regex as fallback
    const simpleShapeTest = spTreeContent.includes('<p:sp>');
    console.log('Simple shape test result:', simpleShapeTest ? 'shapes exist' : 'no shapes');
  }
}

/**
 * Extract picture elements from the slide
 */
function extractPictureElements(
  slideXml: string,
  spTreeContent: string,
  slideRels: Record<string, string>,
  zip: PizZip,
  elements: PPTXElement[]
): void {
  // Find all picture nodes
  const pictureRegex = /<p:pic[^>]*>([\s\S]*?)<\/p:pic>/g;
  let match;
  let picCount = 0;
  
  while ((match = pictureRegex.exec(spTreeContent)) !== null) {
    picCount++;
    const picNode = match[0];
    console.log(`Processing picture ${picCount}`);
    const image = extractImage(slideXml, picNode, slideRels, zip);
    
    if (image) {
      console.log(`Added image element`);
      // Convert the image path to a data URL
      if (image.src) {
        const dataUrl = createImageDataUrl(image.src, zip);
        console.log('Created image data URL');
        if (dataUrl) {
          image.src = dataUrl;
        }
      }
      elements.push(image);
    }
  }
}

/**
 * Extract group elements from the slide
 */
function extractGroupElements(
  slideXml: string,
  spTreeContent: string,
  slideRels: Record<string, string>,
  zip: PizZip,
  elements: PPTXElement[]
): void {
  // Find all group nodes
  const groupRegex = /<p:grpSp>([\s\S]*?)<\/p:grpSp>/g;
  let match;
  let groupCount = 0;
  
  while ((match = groupRegex.exec(spTreeContent)) !== null) {
    groupCount++;
    const groupNode = match[0];
    console.log(`Processing group ${groupCount}`);
    
    // Process shapes within the group
    extractShapeElements(slideXml, groupNode, slideRels, zip, elements);
    
    // Process pictures within the group
    extractPictureElements(slideXml, groupNode, slideRels, zip, elements);
  }
  
  console.log(`Found ${groupCount} groups in slide`);
  
  // If no elements were found with any method, create a basic placeholder text element
  if (elements.length === 0) {
    console.log('No elements found in slide, creating placeholder element');
    
    // Create a simple placeholder element with proper typing
    const placeholderElement: PPTXElement = {
      id: `placeholder-${Date.now()}`,
      type: 'text',
      x: 50,
      y: 50,
      width: 400,
      height: 100,
      zIndex: 1,
      paragraphs: [{
        text: 'Slide content could not be extracted',
        runs: [{
          text: 'Slide content could not be extracted',
          // Use properties that are definitely in the type
          bold: true,
          color: { type: 'rgb', value: '#333333' }
        }]
      }]
    };
    
    elements.push(placeholderElement);
  }
}

/**
 * Extract a group shape and its children
 */
function extractGroup(
  slideXml: string,
  groupNode: string,
  slideRels: Record<string, string>,
  zip: PizZip
): PPTXElement | null {
  try {
    // Extract group ID
    const idMatch = groupNode.match(/id="(\d+)"/);
    const nameMatch = groupNode.match(/name="([^"]*)"/);
    
    if (!idMatch) return null;
    
    const id = idMatch[1];
    const name = nameMatch ? nameMatch[1] : `Group ${id}`;
    
    // Extract position and dimensions
    const position = extractGroupPosition(groupNode);
    if (!position) return null;
    
    // Extract child elements
    const childElements: PPTXElement[] = [];
    
    // Recursively extract shapes in the group
    const shapeRegex = /<p:sp>([\\s\\S]*?)<\/p:sp>/g;
    let match;
    while ((match = shapeRegex.exec(groupNode)) !== null) {
      const shapeNode = match[0];
      const shape = extractShape(slideXml, shapeNode, slideRels, zip);
      if (shape) {
        // Adjust positions relative to group
        shape.x += position.x;
        shape.y += position.y;
        childElements.push(shape);
      }
    }
    
    // Recursively extract pictures in the group
    const pictureRegex = /<p:pic>([\\s\\S]*?)<\/p:pic>/g;
    while ((match = pictureRegex.exec(groupNode)) !== null) {
      const picNode = match[0];
      const image = extractImage(slideXml, picNode, slideRels, zip);
      if (image) {
        // Adjust positions relative to group
        image.x += position.x;
        image.y += position.y;
        if (image.src) {
          const dataUrl = createImageDataUrl(image.src, zip);
          if (dataUrl) {
            image.src = dataUrl;
          }
        }
        childElements.push(image);
      }
    }
    
    return {
      id,
      name,
      type: 'group',
      x: position.x,
      y: position.y,
      width: position.width,
      height: position.height,
      rotation: position.rotation,
      flipH: position.flipH,
      flipV: position.flipV,
      children: childElements,
      zIndex: extractZIndex(groupNode)
    };
  } catch (error) {
    console.error('Error extracting group:', error);
    return null;
  }
}

/**
 * Extract position and dimensions from a group shape node
 */
function extractGroupPosition(groupNode: string) {
  const xfrmMatch = groupNode.match(/<a:xfrm[^>]*>([\\s\\S]*?)<\/a:xfrm>/);
  if (!xfrmMatch) return null;
  
  const xfrmContent = xfrmMatch[1];
  
  // Extract position
  const offMatch = xfrmContent.match(/<a:off[^>]*x="([^"]*)"[^>]*y="([^"]*)"/);
  // Extract dimensions
  const extMatch = xfrmContent.match(/<a:ext[^>]*cx="([^"]*)"[^>]*cy="([^"]*)"/);
  
  if (!offMatch || !extMatch) return null;
  
  // Extract rotation if present
  const rotMatch = xfrmContent.match(/rot="([^"]*)"/);
  const rotation = rotMatch ? parseInt(rotMatch[1], 10) / 60000 : 0; // 60,000 = 1 degree in OOXML
  
  // Extract flip properties if present
  const flipH = xfrmContent.includes('flipH="1"') || xfrmContent.includes('flipH="true"');
  const flipV = xfrmContent.includes('flipV="1"') || xfrmContent.includes('flipV="true"');
  
  // Convert EMUs (English Metric Units) to points (1 EMU = 1/914400 inch)
  const emuToPoints = (emu: string) => parseInt(emu, 10) / 9144;
  
  return {
    x: emuToPoints(offMatch[1]),
    y: emuToPoints(offMatch[2]),
    width: emuToPoints(extMatch[1]),
    height: emuToPoints(extMatch[2]),
    rotation,
    flipH,
    flipV
  };
}

/**
 * Extract z-index/drawing order
 */
function extractZIndex(node: string): number {
  const idMatch = node.match(/id="(\d+)"/);
  return idMatch ? parseInt(idMatch[1], 10) : 0;
}
