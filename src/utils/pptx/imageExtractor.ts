import PizZip from 'pizzip';
import { PPTXImageElement } from '../../types/pptx';
import { resolveRelationshipTarget } from './relationParser';
import { emuToScaledX, emuToScaledY } from './units';

// Common paths where images might be located in PPTX files
const POTENTIAL_IMAGE_PATHS = [
  '', // Try the exact path first
  'ppt/media/', 
  'media/',
  'word/media/',
  'xl/media/',
  'ppt/embeddings/',
  'embeddings/'
];

/**
 * Extracts image elements from a slide's XML content
 * @param xml The slide XML content
 * @param picNode The specific picture node XML string
 * @param relationships The slide's relationships
 * @param zip The PPTX zip file
 * @returns The parsed image element
 */
export function extractImage(
  xml: string,
  picNode: string,
  relationships: Record<string, string>,
  zip: PizZip,
  originalSizeEmu?: { width: number; height: number },
  scaleFactor: number = 1
): PPTXImageElement | null {
  try {
    // Extract image ID
    const idMatch = picNode.match(/id="(\d+)"/);
    const nameMatch = picNode.match(/name="([^"]*)"/);
    
    if (!idMatch) return null;
    
    const id = idMatch[1];
    const name = nameMatch ? nameMatch[1] : `Image ${id}`;
    
    console.log(`Processing image element ID: ${id}, Name: ${name}`);
    
    // Extract position and size
    const position = extractImagePosition(picNode);
    if (!position) {
      console.warn('Failed to extract image position');
      return null;
    }
    
    // Extract image source (relationship)
    const src = extractImageSource(picNode, relationships, 'ppt/slides');
    if (!src) {
      console.warn('Failed to extract image source');
      return null;
    }
    
    // Extract crop and other image data
    const imageData = extractImageData(picNode);
    
    // Create data URL for the image so it can be displayed directly
    const dataUrl = createImageDataUrl(src, zip);
    
    if (!dataUrl) {
      console.warn('Failed to create image data URL for', src);
      // Generate a placeholder data URL - at least show a box with the image name
      const placeholderUrl = generatePlaceholderImage(name);
      console.log(`Created placeholder for image ${id}`);
      
      return {
        id,
        name,
        type: 'image',
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
        rotation: position.rotation,
        flipH: position.flipH,
        flipV: position.flipV,
        src: placeholderUrl,
        content: placeholderUrl,
        imageData,
        zIndex: extractZIndex(picNode),
        isPlaceholder: true
      };
    } else {
      console.log(`Created data URL for image ${id} with length ${dataUrl.length}`);
    }
    
    return {
      id,
      name,
      type: 'image',
      x: position.x,
      y: position.y,
      width: position.width,
      height: position.height,
      rotation: position.rotation,
      flipH: position.flipH,
      flipV: position.flipV,
      src: dataUrl,
      content: dataUrl, // Add content property for compatibility
      imageData,
      zIndex: extractZIndex(picNode)
    };
  } catch (error) {
    console.error('Error extracting image:', error);
    return null;
  }
}

/**
 * Extract position and dimensions from a picture node
 */
function extractImagePosition(picNode: string) {
  const xfrmMatch = picNode.match(/<a:xfrm[^>]*>([\s\S]*?)<\/a:xfrm>/);
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
  
  // Use the centralized utility functions for consistent EMU to pixel conversion
  return {
    x: emuToScaledX(parseInt(offMatch[1], 10)),
    y: emuToScaledY(parseInt(offMatch[2], 10)),
    width: emuToScaledX(parseInt(extMatch[1], 10)),
    height: emuToScaledY(parseInt(extMatch[2], 10)),
    rotation,
    flipH,
    flipV
  };
}

/**
 * Extract z-index/drawing order
 */
function extractZIndex(picNode: string): number {
  const idMatch = picNode.match(/id="(\d+)"/);
  return idMatch ? parseInt(idMatch[1], 10) : 0;
}

/**
 * Extract the image source from relationship references
 */
function extractImageSource(
  picNode: string,
  relationships: Record<string, string>,
  basePath: string
): string | undefined {
  // Find the blip node that contains the relationship reference
  const blipMatch = picNode.match(/<a:blip[^>]*r:embed="([^"]*)"/);
  if (!blipMatch) return undefined;
  
  const relationshipId = blipMatch[1];
  const target = relationships[relationshipId];
  
  if (!target) return undefined;
  
  // Resolve the target path
  return resolveRelationshipTarget(target, basePath);
}

/**
 * Extract image data like cropping, compression, etc.
 */
function extractImageData(picNode: string): PPTXImageElement['imageData'] {
  const imageData: PPTXImageElement['imageData'] = {};
  
  // Extract cropping information
  const srcRectMatch = picNode.match(/<a:srcRect[^>]*/);
  if (srcRectMatch) {
    const srcRect = srcRectMatch[0];
    
    const leftMatch = srcRect.match(/l="([^"]*)"/);
    const rightMatch = srcRect.match(/r="([^"]*)"/);
    const topMatch = srcRect.match(/t="([^"]*)"/);
    const bottomMatch = srcRect.match(/b="([^"]*)"/);
    
    if (leftMatch || rightMatch || topMatch || bottomMatch) {
      // Convert percentage values (e.g., 10000 = 10%)
      imageData.cropRect = {
        left: leftMatch ? parseInt(leftMatch[1], 10) / 1000 : 0,
        right: rightMatch ? parseInt(rightMatch[1], 10) / 1000 : 0,
        top: topMatch ? parseInt(topMatch[1], 10) / 1000 : 0,
        bottom: bottomMatch ? parseInt(bottomMatch[1], 10) / 1000 : 0
      };
    }
  }
  
  // Extract image effects - brightness, contrast, etc.
  const lumModMatch = picNode.match(/<a:lumMod[^>]*val="([^"]*)"/);
  const lumOffMatch = picNode.match(/<a:lumOff[^>]*val="([^"]*)"/);
  
  if (lumModMatch) {
    // Lum mod affects brightness (as a percentage)
    imageData.brightness = parseInt(lumModMatch[1], 10) / 100000 - 1;
  }
  
  if (lumOffMatch) {
    // Lum off affects contrast
    imageData.contrast = parseInt(lumOffMatch[1], 10) / 100000;
  }
  
  return imageData;
}

/**
 * Create a data URL for an image from the PPTX zip
 * @param imagePath Path to the image in the PPTX
 * @param zip PizZip instance
 * @returns Base64 data URL of the image
 */
/**
 * Generate a placeholder image data URL when the actual image cannot be found
 */
function generatePlaceholderImage(name: string): string {
  // Create a small SVG with the image name
  const text = name.substring(0, 20) + (name.length > 20 ? '...' : '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
    <rect width="200" height="150" fill="#f0f0f0" stroke="#ccc" stroke-width="2"/>
    <text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" fill="#666">
      ${text}
    </text>
    <text x="50%" y="70%" font-family="Arial" font-size="12" text-anchor="middle" fill="#999">
      Image not found
    </text>
  </svg>`;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Find the image in the PPTX archive using different possible paths
 */
function findImageInZip(imagePath: string, zip: PizZip): any {
  // First try with the exact path
  let imageFile = zip.file(imagePath);
  if (imageFile) return imageFile;
  
  console.log(`Trying alternative paths for ${imagePath}`);
  
  // Try alternative paths
  for (const prefix of POTENTIAL_IMAGE_PATHS) {
    // For the root path, we already tried the exact path
    if (prefix === '' && imagePath.indexOf('/') >= 0) continue;
    
    // Get just the filename without path
    const fileName = imagePath.split('/').pop();
    if (!fileName) continue;
    
    const testPath = prefix + fileName;
    imageFile = zip.file(testPath);
    if (imageFile) {
      console.log(`Found image at alternative path: ${testPath}`);
      return imageFile;
    }
    
    // Try case-insensitive search for the image
    const files = zip.file(/.+/);
    const lowerFileName = fileName.toLowerCase();
    
    for (const file of files) {
      if (file.name.toLowerCase().endsWith(lowerFileName)) {
        console.log(`Found image with case-insensitive match: ${file.name}`);
        return file;
      }
    }
  }
  
  // Nothing found
  return null;
}

export function createImageDataUrl(imagePath: string, zip: PizZip): string | undefined {
  try {
    const imageFile = findImageInZip(imagePath, zip);
    if (!imageFile) {
      console.warn(`Image file not found in zip: ${imagePath}`);
      return undefined;
    }
    
    const imageData = imageFile.asUint8Array();
    const base64 = arrayBufferToBase64(imageData.buffer);
    
    // Determine mime type based on file extension
    const extension = imagePath.split('.').pop()?.toLowerCase();
    let mimeType = 'image/jpeg'; // Default
    
    if (extension === 'png') mimeType = 'image/png';
    else if (extension === 'gif') mimeType = 'image/gif';
    else if (extension === 'svg') mimeType = 'image/svg+xml';
    else if (extension === 'wmf') mimeType = 'image/wmf';
    else if (extension === 'emf') mimeType = 'image/emf';
    
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error creating image data URL:', error);
    return undefined;
  }
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  // Node.js Buffer for server-side
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  
  // Browser
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return btoa(binary);
}
