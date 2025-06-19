import { PPTXTheme } from "../../types/pptx";

/**
 * Parses the theme XML to extract color schemes, fonts, and format schemes
 * @param xml The theme XML content
 * @returns The parsed theme object
 */
export function parseTheme(xml: string): PPTXTheme {
  const name = extractThemeName(xml) || 'Default Theme';
  const colorScheme = extractColorScheme(xml);
  const fontScheme = extractFontScheme(xml);
  const formatScheme = extractFormatScheme(xml);
  
  return {
    name,
    colorScheme,
    fontScheme,
    formatScheme
  };
}

/**
 * Extracts the theme name
 */
function extractThemeName(xml: string): string | undefined {
  const nameMatch = xml.match(/<a:theme[^>]*name="([^"]*)"/);
  return nameMatch ? nameMatch[1] : undefined;
}

/**
 * Extracts the color scheme from the theme XML
 */
function extractColorScheme(xml: string): PPTXTheme['colorScheme'] {
  const colors: Record<string, string> = {};
  
  // Extract color scheme name
  const nameMatch = xml.match(/<a:clrScheme[^>]*name="([^"]*)"/);
  const name = nameMatch ? nameMatch[1] : 'Default';
  
  // Extract colors - first find the color scheme section
  const clrSchemeMatch = xml.match(/<a:clrScheme[^>]*>([\\s\\S]*?)<\/a:clrScheme>/);
  
  if (clrSchemeMatch) {
    const clrSchemeSection = clrSchemeMatch[1];
    
    // Process each standard color element
    const colorElements = [
      'dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 
      'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'
    ];
    
    // Extract each color value
    for (const colorName of colorElements) {
      // Look for RGB color values, srgb or sysClr
      const srgbMatch = new RegExp(`<a:${colorName}[^>]*>[^<]*<a:srgbClr[^>]*val="([^"]*)"`, 'i').exec(clrSchemeSection);
      const sysClrMatch = new RegExp(`<a:${colorName}[^>]*>[^<]*<a:sysClr[^>]*val="([^"]*)"[^>]*lastClr="([^"]*)"`, 'i').exec(clrSchemeSection);
      
      if (srgbMatch) {
        colors[colorName] = `#${srgbMatch[1]}`;
      } else if (sysClrMatch) {
        colors[colorName] = `#${sysClrMatch[2]}`; // Use lastClr as the actual color value
      }
    }
  }
  
  return {
    name,
    colors
  };
}

/**
 * Extracts the font scheme from the theme XML
 */
function extractFontScheme(xml: string): PPTXTheme['fontScheme'] {
  // Default values
  let name = 'Office';
  const majorFont = { latin: 'Calibri' };
  const minorFont = { latin: 'Calibri' };
  
  // Extract font scheme name
  const nameMatch = xml.match(/<a:fontScheme[^>]*name="([^"]*)"/);
  if (nameMatch) {
    name = nameMatch[1];
  }
  
  // Extract major font
  const majorFontMatch = xml.match(/<a:majorFont>([\\s\\S]*?)<\/a:majorFont>/);
  if (majorFontMatch) {
    const majorSection = majorFontMatch[1];
    
    const latinMatch = majorSection.match(/<a:latin[^>]*typeface="([^"]*)"/);
    if (latinMatch) {
      majorFont.latin = latinMatch[1];
    }
    
    const eaMatch = majorSection.match(/<a:ea[^>]*typeface="([^"]*)"/);
    if (eaMatch) {
      majorFont.ea = eaMatch[1];
    }
    
    const csMatch = majorSection.match(/<a:cs[^>]*typeface="([^"]*)"/);
    if (csMatch) {
      majorFont.cs = csMatch[1];
    }
  }
  
  // Extract minor font
  const minorFontMatch = xml.match(/<a:minorFont>([\\s\\S]*?)<\/a:minorFont>/);
  if (minorFontMatch) {
    const minorSection = minorFontMatch[1];
    
    const latinMatch = minorSection.match(/<a:latin[^>]*typeface="([^"]*)"/);
    if (latinMatch) {
      minorFont.latin = latinMatch[1];
    }
    
    const eaMatch = minorSection.match(/<a:ea[^>]*typeface="([^"]*)"/);
    if (eaMatch) {
      minorFont.ea = eaMatch[1];
    }
    
    const csMatch = minorSection.match(/<a:cs[^>]*typeface="([^"]*)"/);
    if (csMatch) {
      minorFont.cs = csMatch[1];
    }
  }
  
  return {
    name,
    majorFont,
    minorFont
  };
}

/**
 * Extracts format schemes (fill styles, line styles, etc.)
 */
function extractFormatScheme(xml: string): PPTXTheme['formatScheme'] {
  // Format scheme name
  const nameMatch = xml.match(/<a:fmtScheme[^>]*name="([^"]*)"/);
  const name = nameMatch ? nameMatch[1] : 'Office';
  
  // For now, we'll return placeholders - these can be expanded later
  return {
    name,
    fillStyles: [], // TODO: Extract fill styles
    lineStyles: [], // TODO: Extract line styles
    effectStyles: [], // TODO: Extract effect styles
    bgFillStyles: [] // TODO: Extract background fill styles
  };
}
