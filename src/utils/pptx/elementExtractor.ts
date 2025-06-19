import PizZip from 'pizzip';
import { PPTXElement, PPTXGroupElement, PPTXTextElement } from '../../types/pptx';
import { extractShape } from './shapeExtractor';
import { extractImage } from './imageExtractor';
import { createImageDataUrl } from './imageExtractor';

/**
 * Extract elements from a slide's XML content
 * @param slideXml The slide XML content
 * @param slideRels The slide's relationships
 * @param zip The PowerPoint zip file
 * @param originalSizeEmu The original slide dimensions in EMU
 * @param scaleFactor The scale factor to apply to all elements
 * @returns The extracted slide elements
 */
export function extractSlideElements(
  slideXml: string,
  slideRels: Record<string, string>,
  zip: PizZip,
  originalSizeEmu?: { width: number; height: number },
  scaleFactor: number = 1
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
    extractGroupElements(slideXml, spTreeContent, slideRels, zip, elements, originalSizeEmu, scaleFactor);
    
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
  // Find all shape nodes using a more robust regex that handles XML variations
  const shapeRegex = /<p:sp(?:[^>]*)>([\s\S]*?)<\/p:sp>/g;
  let match;
  let shapeCount = 0;
  
  console.log('Starting shape extraction with improved regex...');
  
  while ((match = shapeRegex.exec(spTreeContent)) !== null) {
    shapeCount++;
    const shapeNode = match[0];
    console.log(`Processing shape ${shapeCount}`);
    const shape = extractShape(slideXml, shapeNode, slideRels, zip);
    
    if (shape) {
      console.log(`Added shape: ${shape.type}, Text content: ${shape.textContent ? 'present' : 'none'}`);
      elements.push(shape);
    }
  }
  
  console.log(`Found ${shapeCount} shapes in slide`);
  if (shapeCount === 0) {
    // Try a simpler regex as fallback
    const simpleShapeTest = spTreeContent.includes('<p:sp');
    console.log('Simple shape test result:', simpleShapeTest ? 'shapes exist' : 'no shapes');
    
    if (simpleShapeTest) {
      // More aggressive fallback extraction - try to find text in any XML element
      console.log('Trying fallback text extraction...');
      extractTextFromPlaceholders(slideXml, spTreeContent, elements);
    }
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
 * Extract text from placeholders and other elements that might contain text
 * This is a fallback method when regular shape extraction doesn't find text
 */
function extractTextFromPlaceholders(
  slideXml: string,
  spTreeContent: string,
  elements: PPTXElement[]
): void {
  try {
    // Look for any text content in the XML, even outside of shape elements
    const textRegex = /<a:t>([^<]+)<\/a:t>/g;
    let textMatch;
    let textCount = 0;
    const textContents: string[] = [];
    
    while ((textMatch = textRegex.exec(spTreeContent)) !== null) {
      if (textMatch[1] && textMatch[1].trim()) {
        textContents.push(textMatch[1].trim());
        textCount++;
      }
    }
    
    if (textCount > 0) {
      console.log(`Found ${textCount} text fragments in slide XML`);
      
      // Create a text element with the extracted content
      const placeholderElement: PPTXTextElement = {
        id: `text-${Date.now()}`,
        type: 'text',
        x: 50,
        y: 50,
        width: 600,
        height: Math.max(50, textContents.length * 20), // Height based on number of text lines
        zIndex: 5,
        paragraphs: textContents.map(text => ({
          text,
          runs: [{
            text,
            bold: false,
            italic: false,
            underline: false,
            color: { type: 'rgb', value: '#000000' }
          }]
        }))
      };
      
      elements.push(placeholderElement);
      console.log('Added fallback text element with content:', 
                 textContents.join('\n').substring(0, 50) + (textContents.join('\n').length > 50 ? '...' : ''));
    }
  } catch (error) {
    console.error('Error in extractTextFromPlaceholders:', error);
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
  elements: PPTXElement[],
  originalSizeEmu?: { width: number; height: number },
  scaleFactor: number = 1
): void {
  // Find all group nodes
  const groupRegex = /<p:grpSp([^>]*)>([\s\S]*?)<\/p:grpSp>/g;
  let match;
  let groupCount = 0;
  
  while ((match = groupRegex.exec(spTreeContent)) !== null) {
    groupCount++;
    const groupAttrs = match[1] || '';
    const groupContent = match[2];
    const groupNode = match[0];
    
    console.log(`Processing group ${groupCount}`);
    
    // Extract group ID
    const idMatch = groupAttrs.match(/id="([^"]*)"/); 
    const groupId = idMatch ? idMatch[1] : `group-${Date.now()}-${groupCount}`;
    
    // Extract group position and transform
    const xfrmMatch = groupContent.match(/<p:xfrm([^>]*)>([\s\S]*?)<\/p:xfrm>/);
    if (!xfrmMatch) continue;
    
    const xfrmAttrs = xfrmMatch[1] || '';
    const xfrmContent = xfrmMatch[2];
    
    // Get position from off attribute
    const offMatch = xfrmContent.match(/<a:off\s+x="([^"]*)"\s+y="([^"]*)"\/?>/);
    if (!offMatch) continue;
    
    // Get dimensions from ext attribute
    const extMatch = xfrmContent.match(/<a:ext\s+cx="([^"]*)"\s+cy="([^"]*)"\/?>/);
    if (!extMatch) continue;
    
    // Convert EMUs to pixels using scale factor
    const x = parseInt(offMatch[1]) / 12700 * scaleFactor;
    const y = parseInt(offMatch[2]) / 12700 * scaleFactor;
    const width = parseInt(extMatch[1]) / 12700 * scaleFactor;
    const height = parseInt(extMatch[2]) / 12700 * scaleFactor;
    
    // Check for rotation
    const rotMatch = xfrmAttrs.match(/rot="([^"]*)"\/?>/);
    let rotation = 0;
    if (rotMatch) {
      // Convert from 60000ths of a degree to degrees
      rotation = parseInt(rotMatch[1]) / 60000;
    }
    
    // Extract all child elements within the group
    const childElements: PPTXElement[] = [];
    
    // Extract shapes within the group
    const childShapeRegex = /<p:sp([^>]*)>([\s\S]*?)<\/p:sp>/g;
    let shapeMatch;
    
    while ((shapeMatch = childShapeRegex.exec(groupContent)) !== null) {
      const shapeNode = shapeMatch[0];
      const shape = extractShape(slideXml, shapeNode, slideRels, zip, originalSizeEmu, scaleFactor);
      
      if (shape) {
        // Adjust position relative to group
        shape.groupRelativeX = shape.x;
        shape.groupRelativeY = shape.y;
        shape.x += x;
        shape.y += y;
        childElements.push(shape);
      }
    }
    
    // Extract pictures within the group
    const childPicRegex = /<p:pic([^>]*)>([\s\S]*?)<\/p:pic>/g;
    let picMatch;
    
    while ((picMatch = childPicRegex.exec(groupContent)) !== null) {
      const picNode = picMatch[0];
      const picture = extractImage(slideXml, picNode, slideRels, zip, originalSizeEmu, scaleFactor);
      
      if (picture) {
        // Adjust position relative to group
        picture.groupRelativeX = picture.x;
        picture.groupRelativeY = picture.y;
        picture.x += x;
        picture.y += y;
        childElements.push(picture);
      }
    }
    
    // If we found child elements, create a group element
    if (childElements.length > 0) {
      const groupElement: PPTXGroupElement = {
        id: groupId,
        type: 'group',
        x: x,
        y: y,
        width: width,
        height: height,
        rotation: rotation,
        children: childElements,
        zIndex: childElements.length > 0 ? 
          Math.min(...childElements.map(el => el.zIndex || 0)) : 0
      };
      
      elements.push(groupElement);
    } else {
      // If no children were extracted, process all shapes and images individually
      // as a fallback
      extractShapeElements(slideXml, groupContent, slideRels, zip, elements);
      extractPictureElements(slideXml, groupContent, slideRels, zip, elements);
    }
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
