
export interface SlideElement {
  id: string;
  type: 'text' | 'rectangle' | 'circle' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
}

export interface Slide {
  id: string;
  title: string;
  content: string;
  backgroundColor: string;
  elements: SlideElement[];
}
