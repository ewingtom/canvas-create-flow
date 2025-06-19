import PizZip from 'pizzip';
import { PPTXShapeElement, PPTXShapeProperties, PPTXFill, PPTXOutline, PPTXColor } from '../../types/pptx';
import { extractTextFromShape } from './textExtractor';

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
  zip: PizZip
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
  
  // Convert EMUs (English Metric Units) to points (1 EMU = 1/914400 inch)
  const emuToPoints = (emu: string) => parseInt(emu, 10) / 9144; // Simplified for readability (1/100th of a point)
  
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
  const solidFillMatch = shapeNode.match(/<a:solidFill>([\\s\\S]*?)<\/a:solidFill>/);
  if (solidFillMatch) {
    const color = extractColor(solidFillMatch[1]);
    if (color) {
      return {
        type: 'solid',
        color
      };
    }
  }
  
  // Gradient fill (simplified for now)
  if (shapeNode.includes('<a:gradFill>')) {
    // For now, just indicate it's a gradient - detailed extraction would be more complex
    return {
      type: 'gradient',
      stops: [
        { position: 0, color: { type: 'rgb', value: '#FFFFFF' } },
        { position: 100, color: { type: 'rgb', value: '#000000' } }
      ]
    };
  }
  
  // Pattern fill
  if (shapeNode.includes('<a:pattFill>')) {
    // Simplified pattern fill detection
    return {
      type: 'pattern',
      preset: 'pct5', // Default pattern type
      foreColor: { type: 'rgb', value: '#000000' },
      backColor: { type: 'rgb', value: '#FFFFFF' }
    };
  }
  
  // Blip fill (image)
  if (shapeNode.includes('<a:blipFill>')) {
    return {
      type: 'blip',
      blip: 'image', // Would need to extract the actual image reference
      stretch: true
    };
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
