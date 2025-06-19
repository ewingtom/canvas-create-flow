/**
 * Parses relationship XML files in PowerPoint
 * These files map IDs to target resources
 */

/**
 * Parses a relationships XML file and returns a map of relationship IDs to target paths
 * @param xml The relationships XML content
 * @returns A record mapping relationship IDs to target paths
 */
export function parseRelationships(xml: string): Record<string, string> {
  const relationships: Record<string, string> = {};
  
  // Extract all relationship elements
  const relationshipRegex = /<Relationship[^>]*Id="([^"]*)"[^>]*Target="([^"]*)"/g;
  let match;
  
  while ((match = relationshipRegex.exec(xml)) !== null) {
    const id = match[1];
    const target = match[2];
    relationships[id] = target;
  }
  
  return relationships;
}

/**
 * Convert a relationship target to its full path within the PPTX package
 * @param target The target path from the relationship
 * @param basePath The base directory path
 */
export function resolveRelationshipTarget(target: string, basePath: string): string {
  if (target.startsWith('/')) {
    // Absolute path within the package
    return target.substring(1); // Remove leading slash
  } else if (target.startsWith('../')) {
    // Relative path going up directories
    const baseDir = basePath.split('/').slice(0, -1).join('/');
    return resolveRelativePath(target, baseDir);
  } else {
    // Relative path in the same directory
    const baseDir = basePath.split('/').slice(0, -1).join('/');
    return `${baseDir}/${target}`;
  }
}

/**
 * Resolves a relative path against a base directory
 */
function resolveRelativePath(relativePath: string, baseDir: string): string {
  const parts = relativePath.split('/');
  const baseParts = baseDir.split('/');
  
  for (const part of parts) {
    if (part === '..') {
      baseParts.pop();
    } else if (part !== '.') {
      baseParts.push(part);
    }
  }
  
  return baseParts.join('/');
}

/**
 * Gets the media type (MIME type) for a given relationship type
 * @param typeString The relationship type URI
 */
export function getMediaTypeForRelationship(typeString: string): string | undefined {
  const typeMap: Record<string, string> = {
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image': 'image',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart': 'chart',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/table': 'table',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/video': 'video',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio': 'audio',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide': 'slide',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject': 'oleObject',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/package': 'package',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData': 'diagram'
  };
  
  return typeMap[typeString];
}
