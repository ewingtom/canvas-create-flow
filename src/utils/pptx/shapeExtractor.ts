import PizZip from 'pizzip';
import { 
  PPTXShapeElement, 
  PPTXShapeProperties, 
  PPTXFill, 
  PPTXOutline, 
  PPTXGradientFill,
  PPTXColor,
  PPTXSolidFill,
  PPTXPatternFill,
  PPTXBlipFill,
  PPTXRGBColor,
  PPTXSchemeColor 
} from '../../types/pptx';
import { extractTextFromShape } from './textExtractor';
import { emuToScaledX, emuToScaledY, emuToPoints } from './units';

/**
 * Extracts shape elements from a slide's XML content
 * @param xml The full slide XML
 * @param shapeNode The specific shape node XML string
 * @param relationships The slide's relationships
 * @param zip The PPTX zip file
 * @returns The parsed shape element
 */
export function extractShape(
  xml: string,
  shapeNode: string,
  relationships: Record<string, string>,
  zip: PizZip,
  originalSizeEmu?: { width: number; height: number },
  scaleFactor: number = 1
): PPTXShapeElement | null {
  try {
    // Extract shape ID
    const idMatch = shapeNode.match(/id="(\d+)"/);
    const nameMatch = shapeNode.match(/name="([^"]*)"/);
    
    if (!idMatch) return null;
    
    const id = idMatch[1];
    const name = nameMatch ? nameMatch[1] : `Shape ${id}`;
    
    // Extract position and size
    const position = extractShapePosition(shapeNode);
    if (!position) return null;
    
    // Extract shape type
    const shapeType = extractShapeType(shapeNode) || 'rect';
    
    // Extract shape properties (fill, outline, effects)
    const shapeProperties = extractShapeProperties(shapeNode);
    
    // Extract text content if present
    const textContent = extractTextFromShape(shapeNode);
    
    return {
      id,
      name,
      type: 'shape',
      shapeType,
      x: position.x,
      y: position.y,
      width: position.width,
      height: position.height,
      rotation: position.rotation,
      flipH: position.flipH,
      flipV: position.flipV,
      shapeProperties,
      textContent,
      zIndex: extractZIndex(shapeNode)
    };
  } catch (error) {
    console.error('Error extracting shape:', error);
    return null;
  }
}

/**
 * Extract position and dimensions from a shape node
 */
function extractShapePosition(shapeNode: string) {
  const xfrmMatch = shapeNode.match(/<a:xfrm[^>]*>([\\s\\S]*?)<\/a:xfrm>/);
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
 * Extract the shape type from a shape node
 */
function extractShapeType(shapeNode: string): string | undefined {
  const presetMatch = shapeNode.match(/<a:prstGeom[^>]*prst="([^"]*)"/);
  if (presetMatch) {
    return presetMatch[1]; // rect, ellipse, etc.
  }
  
  // Check for custom geometry
  if (shapeNode.includes('<a:custGeom')) {
    return 'custom';
  }
  
  return undefined;
}

/**
 * Extract z-index/drawing order from a shape node
 */
function extractZIndex(shapeNode: string): number {
  // In OOXML, elements are drawn in document order, so we'll use an approximation
  // based on the shape's ID, which tends to increase with draw order
  const idMatch = shapeNode.match(/id="(\d+)"/);
  return idMatch ? parseInt(idMatch[1], 10) : 0;
}

/**
 * Extract shape properties like fill, outline, and effects
 */
function extractShapeProperties(shapeNode: string): PPTXShapeProperties {
  const properties: PPTXShapeProperties = {};
  
  // Extract fill
  properties.fill = extractFill(shapeNode);
  
  // Extract outline/border
  properties.outline = extractOutline(shapeNode);
  
  // TODO: Extract effects (shadows, glow, etc.)
  
  return properties;
}

/**
 * Extract fill properties from a shape node
 */
function extractFill(shapeNode: string): PPTXFill | undefined {
  // Check for no fill
  if (shapeNode.includes('<a:noFill/>')) {
    return { type: 'none' };
  }
  
  // Solid fill
  const solidFillMatch = shapeNode.match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/);
  if (solidFillMatch) {
    const color = extractColor(solidFillMatch[1]);
    if (color) {
      return {
        type: 'solid',
        color
      };
    }
  }
  
  // Gradient fill - more detailed extraction
  const gradFillMatch = shapeNode.match(/<a:gradFill([^>]*)>([\s\S]*?)<\/a:gradFill>/);
  if (gradFillMatch) {
    const gradAttrs = gradFillMatch[1];
    const gradContent = gradFillMatch[2];
    
    // Default values
    const gradFill: PPTXGradientFill = {
      type: 'gradient',
      stops: [],
      angle: 0
    };
    
    // Extract gradient path (for radial/path gradients)
    const pathMatch = gradContent.match(/<a:path[^>]*path="([^"]*)"/);  
    if (pathMatch) {
      if (pathMatch[1] === 'circle' || pathMatch[1] === 'rect' || pathMatch[1] === 'shape') {
        gradFill.path = pathMatch[1];
      }
    } else {
      // Linear gradient - extract angle
      const angleMatch = gradAttrs.match(/rot="([^"]*)"/);  
      if (angleMatch) {
        // Convert angle from 60000ths of a degree
        gradFill.angle = parseInt(angleMatch[1]) / 60000;
      }
    }
    
    // Extract gradient stops
    const gsLstMatch = gradContent.match(/<a:gsLst>([\s\S]*?)<\/a:gsLst>/);
    if (gsLstMatch) {
      const stopsContent = gsLstMatch[1];
      const stopRegex = /<a:gs pos="([^"]*)"[^>]*>([\s\S]*?)<\/a:gs>/g;
      let stopMatch;
      
      while ((stopMatch = stopRegex.exec(stopsContent)) !== null) {
        const position = parseInt(stopMatch[1]) / 1000; // Convert from thousands
        const color = extractColor(stopMatch[2]);
        
        if (color) {
          gradFill.stops.push({ position, color });
        }
      }
    }
    
    // If no stops were found, provide defaults
    if (gradFill.stops.length === 0) {
      gradFill.stops = [
        { position: 0, color: { type: 'rgb', value: '#FFFFFF' } },
        { position: 100, color: { type: 'rgb', value: '#000000' } }
      ];
    }
    
    return gradFill;
  }
  
  // Pattern fill - enhanced extraction
  const pattFillMatch = shapeNode.match(/<a:pattFill[^>]*prst="([^"]*)"[^>]*>([\s\S]*?)<\/a:pattFill>/);
  if (pattFillMatch) {
    const preset = pattFillMatch[1];
    const content = pattFillMatch[2];
    
    // Extract foreground and background colors
    const fgFillMatch = content.match(/<a:fgClr>([\s\S]*?)<\/a:fgClr>/);  
    const bgFillMatch = content.match(/<a:bgClr>([\s\S]*?)<\/a:bgClr>/);  
    
    const foreColor: PPTXRGBColor = fgFillMatch ? 
      (extractColor(fgFillMatch[1]) as PPTXRGBColor || { type: 'rgb', value: '#000000' }) : 
      { type: 'rgb', value: '#000000' };
    
    const backColor: PPTXRGBColor = bgFillMatch ? 
      (extractColor(bgFillMatch[1]) as PPTXRGBColor || { type: 'rgb', value: '#FFFFFF' }) : 
      { type: 'rgb', value: '#FFFFFF' };
    
    return {
      type: 'pattern',
      preset,
      foreColor,
      backColor
    };
  }
  
  // Blip fill (image)
  const blipFillMatch = shapeNode.match(/<a:blipFill[^>]*>([\s\S]*?)<\/a:blipFill>/);
  if (blipFillMatch) {
    const content = blipFillMatch[1];
    const embedMatch = content.match(/r:embed="([^"]*)"/);  
    const hasStretch = content.includes('<a:stretch>');
    const hasTile = content.includes('<a:tile');
    
    const blipFill: PPTXBlipFill = {
      type: 'blip',
      blip: embedMatch ? embedMatch[1] : 'image',
      stretch: hasStretch
    };
    
    // Add tile property if tile is present
    if (hasTile) {
      const tileAttrs = content.match(/<a:tile[^>]*\/?>/);
      if (tileAttrs) {
        blipFill.tile = {}; // Create empty tile object that matches the type
      }
    }
    
    return blipFill;
  }
  
  // Default solid white
  return {
    type: 'solid',
    color: { type: 'rgb', value: '#FFFFFF' }
  };
}

/**
 * Extract outline/border properties from a shape node
 */
function extractOutline(shapeNode: string): PPTXOutline | undefined {
  // Check for no outline
  if (shapeNode.includes('<a:ln><a:noFill/>')) {
    return undefined;
  }
  
  // Line element
  const lnMatch = shapeNode.match(/<a:ln[^>]*>([\\s\\S]*?)<\/a:ln>/);
  if (!lnMatch) return undefined;
  
  const lnContent = lnMatch[1];
  
  // Extract width (default 1pt)
  const widthMatch = lnMatch[0].match(/w="([^"]*)"/);
  const width = widthMatch ? parseInt(widthMatch[1], 10) / 12700 : 1; // Convert EMUs to points
  
  // Extract color
  const color = extractColor(lnContent) || { type: 'rgb', value: '#000000' };
  
  // Extract dash type
  const dashType = extractDashType(lnContent);
  
  return {
    width,
    color,
    dash: dashType
  };
}

/**
 * Extract dash type (solid, dash, dot, etc.)
 */
function extractDashType(xmlContent: string): PPTXOutline['dash'] {
  if (xmlContent.includes('<a:prstDash val="solid"/>')) return 'solid';
  if (xmlContent.includes('<a:prstDash val="dot"/>')) return 'dot';
  if (xmlContent.includes('<a:prstDash val="dash"/>')) return 'dash';
  if (xmlContent.includes('<a:prstDash val="dashDot"/>')) return 'dash-dot';
  if (xmlContent.includes('<a:prstDash val="lgDash"/>')) return 'long-dash';
  if (xmlContent.includes('<a:prstDash val="lgDashDot"/>')) return 'long-dash-dot';
  if (xmlContent.includes('<a:prstDash val="lgDashDotDot"/>')) return 'long-dash-dot-dot';
  return 'solid';
}

/**
 * Extract color information from an XML node
 */
function extractColor(xmlContent: string): PPTXColor | undefined {
  // RGB color
  const srgbMatch = xmlContent.match(/<a:srgbClr[^>]*val="([^"]*)"/);
  if (srgbMatch) {
    return {
      type: 'rgb',
      value: `#${srgbMatch[1]}`
    };
  }
  
  // Scheme color
  const schemeMatch = xmlContent.match(/<a:schemeClr[^>]*val="([^"]*)"/);
  if (schemeMatch) {
    return {
      type: 'scheme',
      value: schemeMatch[1]
    };
  }
  
  // System color
  const sysMatch = xmlContent.match(/<a:sysClr[^>]*val="([^"]*)"/);
  if (sysMatch) {
    // Get the lastClr attribute if present, which is the actual resolved color
    const lastClrMatch = xmlContent.match(/lastClr="([^"]*)"/);
    if (lastClrMatch) {
      return {
        type: 'rgb',
        value: `#${lastClrMatch[1]}`
      };
    }
    return {
      type: 'system',
      value: sysMatch[1]
    };
  }
  
  return undefined;
}
