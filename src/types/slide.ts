// Import PowerPoint types to use for slide background
import { PPTXFill } from './pptx';

export interface SlideElement {
  id: string;
  type: 'text' | 'rectangle' | 'circle' | 'image' | 'ellipse' | 'line' | 'group' | 'shape';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: string;
  rotation?: number;
  fill?: string;
  strokeColor?: string;
  strokeWidth?: number;
  src?: string;
  opacity?: number;
  children?: SlideElement[];
  isPlaceholder?: boolean; // Flag for placeholder images and elements
}

export interface Slide {
  id: string;
  title: string;
  content: string;
  backgroundColor: string;
  elements: SlideElement[];
  background?: {
    fill?: PPTXFill;
    showMasterBackground?: boolean;
  };
}
