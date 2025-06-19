import { PPTXTextElement, PPTXParagraph, PPTXTextRun } from '../../types/pptx';

/**
 * Extracts text content from a shape element
 * @param shapeNode The XML string of the shape node
 * @returns The parsed text element or undefined if no text
 */
export function extractTextFromShape(shapeNode: string): PPTXTextElement | undefined {
  // Check if shape has text content
  const txBodyMatch = shapeNode.match(/<p:txBody>([\\s\\S]*?)<\/p:txBody>/);
  if (!txBodyMatch) return undefined;
  
  const txBodyContent = txBodyMatch[1];
  
  // Extract shape ID to use as text element ID
  const idMatch = shapeNode.match(/id="(\d+)"/);
  const id = idMatch ? idMatch[1] : `text-${Math.random().toString(36).substring(2, 9)}`;
  
  // Extract position from parent shape
  const position = extractPositionFromShape(shapeNode);
  if (!position) return undefined;
  
  // Extract body properties
  const bodyProps = extractBodyProperties(txBodyContent);
  
  // Extract paragraphs
  const paragraphs = extractParagraphs(txBodyContent);
  
  // If no paragraphs were found, return undefined
  if (paragraphs.length === 0) return undefined;
  
  return {
    id,
    type: 'text',
    x: position.x,
    y: position.y,
    width: position.width,
    height: position.height,
    bodyProperties: bodyProps,
    paragraphs
  };
}

/**
 * Extract position and size from parent shape
 */
function extractPositionFromShape(shapeNode: string) {
  const xfrmMatch = shapeNode.match(/<a:xfrm[^>]*>([\\s\\S]*?)<\/a:xfrm>/);
  if (!xfrmMatch) return null;
  
  const xfrmContent = xfrmMatch[1];
  
  // Extract position
  const offMatch = xfrmContent.match(/<a:off[^>]*x="([^"]*)"[^>]*y="([^"]*)"/);
  // Extract dimensions
  const extMatch = xfrmContent.match(/<a:ext[^>]*cx="([^"]*)"[^>]*cy="([^"]*)"/);
  
  if (!offMatch || !extMatch) return null;
  
  // Convert EMUs (English Metric Units) to points
  const emuToPoints = (emu: string) => parseInt(emu, 10) / 9144; // Simplified for readability
  
  return {
    x: emuToPoints(offMatch[1]),
    y: emuToPoints(offMatch[2]),
    width: emuToPoints(extMatch[1]),
    height: emuToPoints(extMatch[2])
  };
}

/**
 * Extract text body properties
 */
function extractBodyProperties(txBodyContent: string): {
  autoFit?: 'none' | 'shape' | 'normal';
  anchor?: 'top' | 'middle' | 'bottom' | 'justified' | 'distributed';
  wrap?: boolean;
  leftInset?: number;
  rightInset?: number;
  topInset?: number;
  bottomInset?: number;
} {
  const bodyPrMatch = txBodyContent.match(/<a:bodyPr([^>]*)>/);
  if (!bodyPrMatch) return {};
  
  const bodyPrAttrs = bodyPrMatch[1];
  
  // Extract anchor (vertical alignment)
  const anchorMatch = bodyPrAttrs.match(/anchor="([^"]*)"/);
  const anchor = anchorMatch ? anchorMatch[1] : 'top';
  
  // Extract text wrapping
  const wrapMatch = bodyPrAttrs.match(/wrap="([^"]*)"/);
  const wrap = wrapMatch ? wrapMatch[1] !== 'none' : true;
  
  // Extract autofit
  const autoFit = txBodyContent.includes('<a:spAutoFit/>') ? 'shape' 
                : txBodyContent.includes('<a:noAutofit/>') ? 'none' 
                : 'normal';
  
  // Extract insets (margins)
  const leftInsMatch = bodyPrAttrs.match(/lIns="([^"]*)"/);
  const rightInsMatch = bodyPrAttrs.match(/rIns="([^"]*)"/);
  const topInsMatch = bodyPrAttrs.match(/tIns="([^"]*)"/);
  const bottomInsMatch = bodyPrAttrs.match(/bIns="([^"]*)"/);
  
  // Convert EMUs to points
  const emuToPoints = (emu: string) => parseInt(emu, 10) / 9144;
  
  // Valid anchor values in PowerPoint
  const validAnchors = ['top', 'middle', 'bottom', 'justified', 'distributed'];
  const typedAnchor = validAnchors.includes(anchor) ? 
    anchor as 'top' | 'middle' | 'bottom' | 'justified' | 'distributed' : 'top';
    
  return {
    anchor: typedAnchor,
    wrap,
    autoFit: autoFit as 'none' | 'shape' | 'normal',
    leftInset: leftInsMatch ? emuToPoints(leftInsMatch[1]) : undefined,
    rightInset: rightInsMatch ? emuToPoints(rightInsMatch[1]) : undefined,
    topInset: topInsMatch ? emuToPoints(topInsMatch[1]) : undefined,
    bottomInset: bottomInsMatch ? emuToPoints(bottomInsMatch[1]) : undefined
  };
}

/**
 * Extract paragraphs and their contained text runs
 */
function extractParagraphs(txBodyContent: string): PPTXParagraph[] {
  const paragraphs: PPTXParagraph[] = [];
  
  // Find all paragraph nodes
  const paragraphRegex = /<a:p>([\\s\\S]*?)<\/a:p>/g;
  let match;
  let paragraphIndex = 0;
  
  while ((match = paragraphRegex.exec(txBodyContent)) !== null) {
    paragraphIndex++;
    const paragraphContent = match[1];
    
    // Extract paragraph properties
    const propsObj = extractParagraphProperties(paragraphContent);
    
    // Extract text runs
    const runs = extractTextRuns(paragraphContent);
    
    // Combine all runs' text to get the paragraph text
    const text = runs.map(run => run.text).join('');
    
    paragraphs.push({
      ...propsObj,
      text,
      runs
    });
  }
  
  return paragraphs;
}

/**
 * Extract paragraph formatting properties
 */
function extractParagraphProperties(paragraphContent: string): Partial<PPTXParagraph> {
  const props: Partial<PPTXParagraph> = {};
  
  // Find paragraph properties node
  const pPrMatch = paragraphContent.match(/<a:pPr([^>]*)>([\\s\\S]*?)<\/a:pPr>/);
  if (!pPrMatch) return props;
  
  const pPrAttrs = pPrMatch[1];
  const pPrContent = pPrMatch[2];
  
  // Extract alignment
  const algnMatch = pPrAttrs.match(/algn="([^"]*)"/);
  if (algnMatch) {
    const alignValue = algnMatch[1];
    // Map alignment values
    const alignMap: Record<string, PPTXParagraph['alignment']> = {
      l: 'left',
      ctr: 'center',
      r: 'right',
      just: 'justified',
      dist: 'distributed'
    };
    props.alignment = alignMap[alignValue] || 'left';
  }
  
  // Extract indentation
  const indentL = pPrAttrs.match(/marL="([^"]*)"/);
  const indentR = pPrAttrs.match(/marR="([^"]*)"/);
  const indent = pPrAttrs.match(/indent="([^"]*)"/);
  
  if (indentL || indentR || indent) {
    const emuToPoints = (emu: string) => parseInt(emu, 10) / 9144;
    props.indentation = {
      left: indentL ? emuToPoints(indentL[1]) : undefined,
      right: indentR ? emuToPoints(indentR[1]) : undefined,
      firstLine: indent && parseInt(indent[1], 10) > 0 ? emuToPoints(indent[1]) : undefined,
      hanging: indent && parseInt(indent[1], 10) < 0 ? emuToPoints(indent[1]) * -1 : undefined
    };
  }
  
  // Extract line spacing
  const lineSpacingMatch = paragraphContent.match(/<a:lnSpc>\\s*<a:spcPct val="([^"]*)"/);
  if (lineSpacingMatch) {
    // Convert percentage value (e.g., 120000 = 120%)
    props.lineSpacing = parseInt(lineSpacingMatch[1], 10) / 100000;
  }
  
  // Extract space before paragraph
  const spcBeforeMatch = paragraphContent.match(/<a:spcBef>\\s*<a:spcPts val="([^"]*)"/);
  if (spcBeforeMatch) {
    // Convert to points (hundredths of points)
    props.spaceBefore = parseInt(spcBeforeMatch[1], 10) / 100;
  }
  
  // Extract space after paragraph
  const spcAfterMatch = paragraphContent.match(/<a:spcAft>\\s*<a:spcPts val="([^"]*)"/);
  if (spcAfterMatch) {
    // Convert to points (hundredths of points)
    props.spaceAfter = parseInt(spcAfterMatch[1], 10) / 100;
  }
  
  // Extract bullet information
  const bullet = extractBulletInfo(pPrContent, pPrAttrs);
  if (bullet) {
    props.bullet = bullet;
  }
  
  // Extract level (indentation level for lists)
  const lvlMatch = pPrAttrs.match(/lvl="([^"]*)"/);
  if (lvlMatch) {
    props.level = parseInt(lvlMatch[1], 10);
  }
  
  return props;
}

/**
 * Extract bullet information from paragraph properties
 */
function extractBulletInfo(pPrContent: string, pPrAttrs: string): PPTXParagraph['bullet'] | undefined {
  // Check for "no bullet"
  if (pPrContent.includes('<a:buNone/>')) {
    return undefined;
  }
  
  const bullet: NonNullable<PPTXParagraph['bullet']> = {
    type: 'bullet'
  };
  
  // Extract bullet character
  const charMatch = pPrContent.match(/<a:buChar\s+char="([^"]*)"/);
  if (charMatch) {
    bullet.char = charMatch[1];
    bullet.type = 'bullet';
  }
  
  // Check for numbered list
  const autoNumMatch = pPrContent.match(/<a:buAutoNum\s+type="([^"]*)"/);
  if (autoNumMatch) {
    bullet.type = 'number';
    // The type attribute contains the numbering format (arabic, roman, etc.)
  }
  
  // Extract bullet size
  const szPtsMatch = pPrContent.match(/<a:buSzPts\s+val="([^"]*)"/);
  if (szPtsMatch) {
    bullet.size = parseInt(szPtsMatch[1], 10) / 100; // Convert from hundredths of points
  }
  
  return bullet;
}

/**
 * Extract text runs (spans of consistently formatted text)
 */
function extractTextRuns(paragraphContent: string): PPTXTextRun[] {
  const runs: PPTXTextRun[] = [];
  
  // Find all text run nodes
  const runRegex = /<a:r>([\\s\\S]*?)<\/a:r>/g;
  let match;
  
  while ((match = runRegex.exec(paragraphContent)) !== null) {
    const runContent = match[1];
    
    // Extract text content
    const textMatch = runContent.match(/<a:t>([\\s\\S]*?)<\/a:t>/);
    let text = textMatch ? textMatch[1] : '';
    
    // Decode XML entities
    text = text.replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"')
               .replace(/&apos;/g, '\'');
    
    // Extract run properties
    const run = extractRunProperties(runContent);
    run.text = text;
    
    runs.push(run);
  }
  
  // Field runs (page numbers, dates, etc.)
  const fldRegex = /<a:fld[^>]*>([\\s\\S]*?)<\/a:fld>/g;
  while ((match = fldRegex.exec(paragraphContent)) !== null) {
    const fldContent = match[1];
    
    // Extract text content
    const textMatch = fldContent.match(/<a:t>([\\s\\S]*?)<\/a:t>/);
    if (textMatch) {
      let text = textMatch[1];
      
      // Decode XML entities
      text = text.replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&amp;/g, '&')
                  .replace(/&quot;/g, '"')
                  .replace(/&apos;/g, '\'');
      
      // Extract run properties
      const run = extractRunProperties(fldContent);
      run.text = text;
      
      runs.push(run);
    }
  }
  
  // Handle end paragraph run (often contains paragraph formatting)
  const endParaMatch = paragraphContent.match(/<a:endParaRPr([^>]*)\/>/);
  if (endParaMatch && runs.length === 0) {
    // If there's only an endParaRPr tag with no text, add an empty run
    runs.push({
      text: '',
      ...extractRunPropertiesFromAttrs(endParaMatch[1])
    });
  }
  
  return runs;
}

/**
 * Extract text run formatting properties
 */
function extractRunProperties(runContent: string): PPTXTextRun {
  // Default run properties
  const run: PPTXTextRun = {
    text: ''
  };
  
  // Find run properties node
  const rPrMatch = runContent.match(/<a:rPr([^>]*)>([\\s\\S]*?)<\/a:rPr>/);
  if (!rPrMatch) return run;
  
  const rPrAttrs = rPrMatch[1];
  const rPrContent = rPrMatch[2];
  
  // Extract properties from attributes
  return {
    ...run,
    ...extractRunPropertiesFromAttrs(rPrAttrs)
  };
}

/**
 * Extract text run formatting from attributes string
 */
function extractRunPropertiesFromAttrs(attrsStr: string): Partial<PPTXTextRun> {
  const props: Partial<PPTXTextRun> = {};
  
  // Extract font size (in hundredths of points)
  const szMatch = attrsStr.match(/sz="([^"]*)"/);
  if (szMatch) {
    props.size = parseInt(szMatch[1], 10) / 100;
  }
  
  // Extract bold
  props.bold = attrsStr.includes('b="1"') || attrsStr.includes('b="true"');
  
  // Extract italic
  props.italic = attrsStr.includes('i="1"') || attrsStr.includes('i="true"');
  
  // Extract underline
  const uMatch = attrsStr.match(/u="([^"]*)"/);
  props.underline = uMatch && uMatch[1] !== 'none';
  
  // Extract strikethrough
  props.strikethrough = attrsStr.includes('strike="sngStrike"');
  
  // Extract baseline (superscript/subscript)
  if (attrsStr.includes('baseline="30000"')) {
    props.baseline = 'superscript';
  } else if (attrsStr.includes('baseline="-25000"')) {
    props.baseline = 'subscript';
  }
  
  // Extract font
  const latinMatch = attrsStr.match(/typeface="([^"]*)"/);
  if (latinMatch) {
    props.font = latinMatch[1];
  }
  
  // Extract character spacing
  const spcMatch = attrsStr.match(/spc="([^"]*)"/);
  if (spcMatch) {
    props.spacing = parseInt(spcMatch[1], 10) / 100; // Convert to points
  }
  
  // Extract caps
  if (attrsStr.includes('cap="all"')) {
    props.caps = 'all';
  } else if (attrsStr.includes('cap="small"')) {
    props.caps = 'small';
  }
  
  return props;
}
