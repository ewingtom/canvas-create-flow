/**
 * Comprehensive PPTX element types and interfaces
 */

// Base interface for all PPTX elements
export interface PPTXBaseElement {
  id: string;
  type: PPTXElementType;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  zIndex?: number;
  // For elements inside groups, store original position relative to group
  groupRelativeX?: number;
  groupRelativeY?: number;
  placeholder?: {
    type: string;
    index?: number;
  };
}

// Element types found in PowerPoint slides
export type PPTXElementType = 
  | 'text' 
  | 'shape' 
  | 'image' 
  | 'table' 
  | 'chart' 
  | 'group'
  | 'smartArt' 
  | 'media'
  | 'oleObject'  // Embedded Excel, etc.
  | 'diagram';

// Text-specific properties
export interface PPTXTextElement extends PPTXBaseElement {
  type: 'text';
  paragraphs: PPTXParagraph[];
  bodyProperties?: {
    autoFit?: 'none' | 'normal' | 'shape';
    anchor?: 'top' | 'middle' | 'bottom' | 'justified' | 'distributed';
    wrap?: boolean;
    leftInset?: number;
    rightInset?: number;
    topInset?: number;
    bottomInset?: number;
  };
  textBoxShapeProperties?: PPTXShapeProperties;
}

export interface PPTXParagraph {
  text?: string;
  runs: PPTXTextRun[];
  alignment?: 'left' | 'center' | 'right' | 'justified' | 'distributed';
  indentation?: {
    left?: number;
    right?: number;
    firstLine?: number;
    hanging?: number;
  };
  lineSpacing?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  level?: number;
  bullet?: {
    type?: 'bullet' | 'number' | 'picture';
    char?: string;
    size?: number;
    color?: PPTXColor;
    font?: string;
  };
}

export interface PPTXTextRun {
  text: string;
  font?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: PPTXColor;
  highlight?: PPTXColor;
  baseline?: 'superscript' | 'subscript' | 'baseline';
  spacing?: number; // character spacing
  caps?: 'none' | 'all' | 'small';
  language?: string;
}

// Shape-specific properties
export interface PPTXShapeElement extends PPTXBaseElement {
  type: 'shape';
  shapeType: string; // rect, ellipse, etc.
  shapeProperties: PPTXShapeProperties;
  textContent?: PPTXTextElement;
}

export interface PPTXShapeProperties {
  fill?: PPTXFill;
  outline?: PPTXOutline;
  effects?: PPTXEffects[];
  geometry?: {
    preset?: string;
    customGeometry?: any; // Custom path data
    adjustValues?: Record<string, number>; // Shape adjustment values
  };
}

// Image-specific properties
export interface PPTXImageElement extends PPTXBaseElement {
  type: 'image';
  src: string;
  // Alternative content property used by SlideCanvas component
  content?: string;
  // Flag to indicate this is a placeholder for a missing image
  isPlaceholder?: boolean;
  imageData?: {
    originalSize?: {
      width: number;
      height: number;
    };
    cropRect?: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    };
    brightness?: number;
    contrast?: number;
    compression?: boolean;
    exifData?: Record<string, any>;
  };
  imageProperties?: PPTXShapeProperties; // For borders, effects, etc.
}

// Table-specific properties
export interface PPTXTableElement extends PPTXBaseElement {
  type: 'table';
  rows: number;
  cols: number;
  cells: PPTXTableCell[][];
  tableProperties?: {
    firstRow?: boolean;
    firstCol?: boolean;
    lastRow?: boolean;
    lastCol?: boolean;
    bandRow?: boolean;
    bandCol?: boolean;
  };
  tableStyles?: {
    wholeTbl?: PPTXTableCellProperties;
    band1H?: PPTXTableCellProperties;
    band2H?: PPTXTableCellProperties;
    band1V?: PPTXTableCellProperties;
    band2V?: PPTXTableCellProperties;
    firstRow?: PPTXTableCellProperties;
    lastRow?: PPTXTableCellProperties;
    firstCol?: PPTXTableCellProperties;
    lastCol?: PPTXTableCellProperties;
  };
  colWidths?: number[];
  rowHeights?: number[];
}

export interface PPTXTableCell {
  content?: PPTXTextElement;
  properties: PPTXTableCellProperties;
  rowSpan?: number;
  colSpan?: number;
  gridSpan?: number;
}

export interface PPTXTableCellProperties {
  fill?: PPTXFill;
  borders?: {
    left?: PPTXOutline;
    right?: PPTXOutline;
    top?: PPTXOutline;
    bottom?: PPTXOutline;
    insideH?: PPTXOutline;
    insideV?: PPTXOutline;
    tl2br?: PPTXOutline; // Diagonal top-left to bottom-right
    tr2bl?: PPTXOutline; // Diagonal top-right to bottom-left
  };
  margins?: {
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  };
  verticalAlignment?: 'top' | 'middle' | 'bottom';
}

// Chart-specific properties
export interface PPTXChartElement extends PPTXBaseElement {
  type: 'chart';
  chartType: string; // bar, column, line, pie, etc.
  chartData: {
    series: PPTXChartSeries[];
    categories?: string[];
  };
  chartProperties: {
    title?: string;
    showLegend?: boolean;
    legendPosition?: 'top' | 'bottom' | 'left' | 'right';
    showAxis?: {
      x?: boolean;
      y?: boolean;
    };
    showGridLines?: {
      x?: boolean;
      y?: boolean;
    };
    dataLabels?: boolean;
    is3D?: boolean;
  };
}

export interface PPTXChartSeries {
  name: string;
  values: number[];
  color?: PPTXColor;
}

// Group element (containing other elements)
export interface PPTXGroupElement extends PPTXBaseElement {
  type: 'group';
  children: PPTXElement[];
}

// Fill types
export type PPTXFill = 
  | PPTXSolidFill
  | PPTXGradientFill
  | PPTXPatternFill
  | PPTXBlipFill
  | PPTXNoFill;

export interface PPTXSolidFill {
  type: 'solid';
  color: PPTXColor;
  alpha?: number; // 0-100%
}

export interface PPTXGradientFill {
  type: 'gradient';
  stops: {
    position: number; // 0-100%
    color: PPTXColor;
    alpha?: number;
  }[];
  angle?: number; // For linear gradients
  path?: 'circle' | 'rect' | 'shape'; // For radial/path gradients
  focus?: {
    x: number;
    y: number;
  }; // 0-100% focus point
}

export interface PPTXPatternFill {
  type: 'pattern';
  preset: string;
  foreColor: PPTXColor;
  backColor: PPTXColor;
}

export interface PPTXBlipFill {
  type: 'blip';
  blip: string; // Image reference
  tint?: number;
  alpha?: number;
  tile?: {
    align?: 'tl' | 't' | 'tr' | 'l' | 'ctr' | 'r' | 'bl' | 'b' | 'br';
    flip?: 'none' | 'x' | 'y' | 'xy';
    offset?: {
      x: number;
      y: number;
    };
    scale?: {
      x: number;
      y: number;
    };
  };
  stretch?: boolean;
}

export interface PPTXNoFill {
  type: 'none';
}

// Outline properties
export interface PPTXOutline {
  width: number;
  color: PPTXColor;
  alpha?: number;
  compound?: 'single' | 'double' | 'thick-thin' | 'thin-thick' | 'triple';
  dash?: 'solid' | 'dot' | 'dash' | 'dash-dot' | 'long-dash' | 'long-dash-dot' | 'long-dash-dot-dot';
  cap?: 'flat' | 'square' | 'round';
  join?: 'round' | 'bevel' | 'miter';
  headEnd?: {
    type: 'none' | 'arrow' | 'diamond' | 'oval' | 'stealth' | 'triangle';
    width: 'sm' | 'med' | 'lg';
    length: 'sm' | 'med' | 'lg';
  };
  tailEnd?: {
    type: 'none' | 'arrow' | 'diamond' | 'oval' | 'stealth' | 'triangle';
    width: 'sm' | 'med' | 'lg';
    length: 'sm' | 'med' | 'lg';
  };
}

// Effects
export type PPTXEffects =
  | PPTXShadowEffect
  | PPTXGlowEffect
  | PPTXReflectionEffect
  | PPTXSoftEdgeEffect;

export interface PPTXShadowEffect {
  type: 'shadow';
  shadow: {
    type: 'outer' | 'inner' | 'perspective';
    color: PPTXColor;
    alpha: number;
    blur: number;
    distance: number;
    angle: number;
    size?: number;
  };
}

export interface PPTXGlowEffect {
  type: 'glow';
  size: number;
  color: PPTXColor;
  alpha?: number;
}

export interface PPTXReflectionEffect {
  type: 'reflection';
  distance: number;
  start: number; // 0-100%
  end: number; // 0-100%
  fade: number;
}

export interface PPTXSoftEdgeEffect {
  type: 'softEdge';
  radius: number;
}

// Color types
export type PPTXColor =
  | PPTXRGBColor
  | PPTXSchemeColor
  | PPTXPresetColor
  | PPTXSystemColor;

export interface PPTXRGBColor {
  type: 'rgb';
  value: string; // hex value
}

export interface PPTXSchemeColor {
  type: 'scheme';
  value: string; // scheme color name
  tint?: number; // -100% to 100%
  shade?: number; // -100% to 100%
  satMod?: number; // saturation modulation
  lumMod?: number; // luminance modulation
}

export interface PPTXPresetColor {
  type: 'preset';
  value: string; // preset color name
}

export interface PPTXSystemColor {
  type: 'system';
  value: string; // system color name
}

// Union type for all PPTX elements
export type PPTXElement =
  | PPTXTextElement
  | PPTXShapeElement
  | PPTXImageElement
  | PPTXTableElement
  | PPTXChartElement
  | PPTXGroupElement;

// Slide properties
export interface PPTXSlide {
  id: string;
  name?: string;
  number: number;
  elements: PPTXElement[];
  background?: {
    fill?: PPTXFill;
    showMasterBackground?: boolean;
  };
  size: {
    width: number;
    height: number;
  };
  layout?: string;
  master?: string;
  showMasterPlaceholders?: boolean;
  notes?: string;
  transition?: {
    type: string;
    duration?: number;
    direction?: string;
    advance?: 'auto' | 'click';
    advanceTime?: number;
  };
}

// Presentation properties
export interface PPTXPresentation {
  slides: PPTXSlide[];
  masters: Record<string, any>;
  layouts: Record<string, any>;
  theme: PPTXTheme;
  size: {
    width: number;
    height: number;
  };
  defaultTextStyle?: any;
}

// Theme definition
export interface PPTXTheme {
  name: string;
  colorScheme: {
    name: string;
    colors: Record<string, string>;
  };
  fontScheme: {
    name: string;
    majorFont: {
      latin: string;
      ea?: string; // East Asian
      cs?: string; // Complex Script
    };
    minorFont: {
      latin: string;
      ea?: string;
      cs?: string;
    };
  };
  formatScheme: {
    name: string;
    fillStyles: any[];
    lineStyles: any[];
    effectStyles: any[];
    bgFillStyles: any[];
  };
}
