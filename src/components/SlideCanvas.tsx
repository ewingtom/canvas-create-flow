import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slide, SlideElement } from '@/types/slide';
import { cn } from '@/lib/utils';

interface SlideCanvasProps {
  slide?: Slide;
  onSlideUpdate: (slideId: string, updates: Partial<Slide>) => void;
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  onSlideUpdate
}) => {
  const [selectedTool, setSelectedTool] = useState<'text' | 'rectangle' | 'circle' | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Debug logs to help diagnose rendering issues
  console.log('SlideCanvas - Current slide:', slide); 
  console.log('SlideCanvas - Has elements:', slide?.elements?.length || 0);

  if (!slide) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">No slide selected</p>
      </div>
    );
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!selectedTool) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newElement: SlideElement = {
      id: Date.now().toString(),
      type: selectedTool,
      x: x - 50,
      y: y - 25,
      width: selectedTool === 'text' ? 200 : 100,
      height: 50,
      content: selectedTool === 'text' ? 'Click to edit text' : '',
      color: selectedTool === 'text' ? '#000000' : '#3b82f6',
      backgroundColor: selectedTool === 'text' ? 'transparent' : '#3b82f6',
      fontSize: 16
    };

    onSlideUpdate(slide.id, {
      elements: [...slide.elements, newElement]
    });

    setSelectedTool(null);
  };

  const handleContentEdit = (content: string) => {
    onSlideUpdate(slide.id, { content });
  };

  // Marine Corps styling is now detected and applied automatically during file upload
  // No need for manual application here

  const handleTitleEdit = (newTitle: string) => {
    if (onSlideUpdate) {
      onSlideUpdate(slide.id, { title: newTitle });
    }
  };

  // This function was already declared elsewhere and has been removed

  // Helper function to convert PPTX color to CSS color
  const getColorFromPPTX = (color: any): string => {
    if (!color) return 'transparent';
    
    if (typeof color === 'string') {
      return color;
    }
    
    if (color.type === 'rgb') {
      return `#${color.value}`;
    }
    
    if (color.type === 'scheme') {
      // Map schema colors to reasonable defaults
      const schemeMap: {[key: string]: string} = {
        'tx1': '#000000', // Text 1
        'tx2': '#666666', // Text 2
        'bg1': '#FFFFFF', // Background 1
        'bg2': '#F2F2F2', // Background 2
        'accent1': '#4472C4',
        'accent2': '#ED7D31',
        'accent3': '#A5A5A5',
        'accent4': '#FFC000',
        'accent5': '#5B9BD5',
        'accent6': '#70AD47'
      };
      return schemeMap[color.value] || '#000000';
    }
    
    return color.value || 'transparent';
  };
  
  // Helper to get background styling from fill property
  const getBackgroundStyle = (fill: any): React.CSSProperties => {
    if (!fill) return {};
    
    if (fill.type === 'none') {
      return { backgroundColor: 'transparent' };
    }
    
    if (fill.type === 'solid') {
      return { backgroundColor: getColorFromPPTX(fill.color) };
    }
    
    if (fill.type === 'gradient') {
      const stops = fill.stops || [];
      if (stops.length >= 2) {
        const stopCss = stops.map(stop => 
          `${getColorFromPPTX(stop.color)} ${stop.position}%`
        ).join(', ');
        
        // Handle different gradient types
        if (fill.path) {
          // Radial gradient
          return { background: `radial-gradient(circle, ${stopCss})` };
        } else {
          // Linear gradient - convert angle from PowerPoint to CSS
          const angle = (fill.angle || 0) % 360;
          // Convert PowerPoint angle to CSS angle (PowerPoint: 0 = north, CSS: 0 = east)
          const cssAngle = (90 - angle + 360) % 360;
          return { background: `linear-gradient(${cssAngle}deg, ${stopCss})` };
        }
      }
    }
    
    if (fill.type === 'pattern') {
      // For pattern fills, we'll use a simplified approach with background color
      return { backgroundColor: getColorFromPPTX(fill.foreColor) || '#e0e0e0' };
    }
    
    if (fill.type === 'blip' && fill.blip) {
      // Handle image fills
      const imgSrc = fill.blip.src || fill.blip.embed;
      if (imgSrc) {
        const bgStyle: React.CSSProperties = {
          backgroundImage: `url(${imgSrc})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        };
        
        // Apply stretch or tile mode
        if (fill.stretch) {
          bgStyle.backgroundSize = 'cover';
        } else if (fill.tile) {
          bgStyle.backgroundRepeat = 'repeat';
          bgStyle.backgroundSize = `${fill.tile.sx || 100}% ${fill.tile.sy || 100}%`;
        } else {
          // Default to contain
          bgStyle.backgroundSize = 'contain';
        }
        
        return bgStyle;
      }
    }
    
    return {};
  };
  
  // Recursive element rendering function to handle groups and nested elements
  const renderElement = (element: SlideElement) => {
    console.log('Rendering element:', element);
    
    // Ensure valid dimensions and positions with fallbacks
    const x = typeof element.x === 'number' ? element.x : 0;
    const y = typeof element.y === 'number' ? element.y : 0;
    const width = typeof element.width === 'number' ? element.width : 100;
    const height = typeof element.height === 'number' ? element.height : 50;
    
    // Get styling from shape properties if available
    const shapeProps = (element as any).shapeProperties;
    const fillStyle = shapeProps?.fill ? getBackgroundStyle(shapeProps.fill) : {};
    const outlineStyle: React.CSSProperties = {};
    
    if (shapeProps?.outline) {
      const outline = shapeProps.outline;
      if (outline.width !== undefined) {
        outlineStyle.borderWidth = `${outline.width}px`;
      }
      if (outline.color) {
        outlineStyle.borderColor = getColorFromPPTX(outline.color);
      }
      if (outline.dashStyle) {
        outlineStyle.borderStyle = outline.dashStyle === 'solid' ? 'solid' : 'dashed';
      }
    }
    
    // Handle rotation and transform properties properly
    let transformStyle = '';
    if (element.rotation) {
      transformStyle += `rotate(${element.rotation}deg) `;
    }
    if ((element as any).flipH) {
      transformStyle += 'scaleX(-1) ';
    }
    if ((element as any).flipV) {
      transformStyle += 'scaleY(-1) ';
    }
    
    const baseStyle: React.CSSProperties = {
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
      backgroundColor: element.backgroundColor || 'transparent',
      color: element.color || '#000000',
      fontSize: element.fontSize ? `${element.fontSize}px` : '16px',
      borderRadius: element.type === 'circle' ? '50%' : '0',
      position: 'absolute',
      border: ((element as any).debug) ? '1px dashed rgba(255, 0, 0, 0.3)' : 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      ...fillStyle,
      ...outlineStyle,
      transform: transformStyle || undefined,
      zIndex: (element as any).zIndex || 0,
    };

    if (element.type === 'image') {
      // Check both src (from parser) and content (legacy field) for image data
      const imgSrc = element.src || element.content;
      console.log('Rendering image element:', element.id, 'has src:', !!element.src, 'has content:', !!element.content, 'is placeholder:', element.isPlaceholder);
      
      if (imgSrc) {
        return (
          <div 
            key={element.id}
            className={`absolute ${element.isPlaceholder ? 'border-2 border-dashed border-orange-300' : 'border border-solid border-gray-400'} hover:border-blue-500 transition-colors`}
            style={{
              ...baseStyle,
              padding: 0,
              overflow: 'hidden',
              backgroundColor: element.isPlaceholder ? '#f8f8f8' : 'transparent',
              zIndex: 5
            }}
          >
            <img
              src={imgSrc}
              alt={`Slide image ${element.id}`}
              className="w-full h-full object-contain"
              onLoad={() => console.log(`Image loaded: ${element.id}`)}
              onError={(e) => {
                console.error(`Failed to load image: ${element.id}`);
                // Replace with inline SVG fallback
                e.currentTarget.src = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect width="200" height="150" fill="#f0f0f0" stroke="#ccc" stroke-width="2"/><text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" fill="#666">Image failed to load</text></svg>')}`;                    
              }}
            />
          </div>
        );
      } else {
        console.warn('Image element missing source:', element.id);
        return (
          <div
            key={element.id}
            className="absolute flex items-center justify-center bg-gray-100 border border-dashed border-gray-300"
            style={baseStyle}
          >
            <span className="text-gray-400">Missing image</span>
          </div>
        );
      }
    }
    
    if (element.type === 'rectangle' || element.type === 'shape') {
      // Extract additional shape properties if available
      const shapeProps = (element as any).shapeProperties || {};
      const hasContent = element.content || (element as any).paragraphs;
      
      return (
        <div
          key={element.id}
          className="absolute hover:outline-1 hover:outline hover:outline-blue-500 transition-colors"
          style={{
            ...baseStyle,
            // Let fillStyle and outlineStyle handle the styling from shapeProps
            borderRadius: (element as any).preset === 'roundRect' ? '8px' : '0',
          }}
        >
          {element.content}
        </div>
      );
    }
    
    if (element.type === 'circle' || element.type === 'ellipse') {
      return (
        <div
          key={element.id}
          className="absolute hover:outline-1 hover:outline hover:outline-blue-500 transition-colors rounded-full"
          style={{
            ...baseStyle,
            // Let fillStyle and outlineStyle handle the styling from shapeProps
          }}
        />
      );
    }
    
    // Handle group elements - render all children within a container
    if (element.type === 'group') {
      const groupElement = element as any;
      const childElements = groupElement.children || [];
      
      return (
        <div
          key={element.id}
          className="absolute"
          style={{
            ...baseStyle,
            border: 'none', // No visible border for group container
            overflow: 'visible', // Allow children to overflow group boundaries
            background: 'transparent',
            pointerEvents: 'none', // Pass through mouse events to children
          }}
        >
          {childElements.map((child: any) => renderElement(child))}
        </div>
      );
    }
    
    if (element.type === 'text') {
      // Check if we have rich text content with paragraphs and runs
      const hasRichText = (element as any).paragraphs && Array.isArray((element as any).paragraphs);
      
      if (hasRichText) {
        const paragraphs = (element as any).paragraphs;
        
        return (
          <div
            key={element.id}
            className="absolute hover:outline-1 hover:outline hover:outline-blue-500 transition-colors"
            style={{
              ...baseStyle,
              display: 'block',
              overflow: 'visible',
              padding: '4px',
              border: 'none'
            }}
          >
            {paragraphs.map((paragraph: any, pIndex: number) => {
              // Apply paragraph level styles
              const paragraphStyle: React.CSSProperties = {
                margin: 0,
                padding: 0,
                textAlign: paragraph.alignment === 'center' ? 'center' : 
                           paragraph.alignment === 'right' ? 'right' : 
                           paragraph.alignment === 'justified' ? 'justify' : 'left',
                lineHeight: paragraph.lineSpacing ? `${paragraph.lineSpacing}%` : 'normal',
                marginBottom: paragraph.spaceAfter ? `${paragraph.spaceAfter}pt` : '0',
                marginTop: paragraph.spaceBefore ? `${paragraph.spaceBefore}pt` : '0',
              };
              
              if (paragraph.indentation) {
                if (paragraph.indentation.left) {
                  paragraphStyle.paddingLeft = `${paragraph.indentation.left}px`;
                }
                if (paragraph.indentation.right) {
                  paragraphStyle.paddingRight = `${paragraph.indentation.right}px`;
                }
                if (paragraph.indentation.firstLine) {
                  paragraphStyle.textIndent = `${paragraph.indentation.firstLine}px`;
                }
              }
              
              return (
                <p key={`p-${element.id}-${pIndex}`} style={paragraphStyle}>
                  {paragraph.runs && Array.isArray(paragraph.runs) ? 
                    paragraph.runs.map((run: any, rIndex: number) => {
                      // Apply text run level styles
                      const runStyle: React.CSSProperties = {
                        fontFamily: run.font || 'inherit',
                        fontSize: run.size ? `${run.size}pt` : 'inherit',
                        fontWeight: run.bold ? 'bold' : 'normal',
                        fontStyle: run.italic ? 'italic' : 'normal',
                        textDecoration: run.underline && run.strikethrough ? 'underline line-through' :
                                       run.underline ? 'underline' : 
                                       run.strikethrough ? 'line-through' : 'none',
                        color: run.color ? getColorFromPPTX(run.color) : 'inherit',
                        backgroundColor: run.highlight ? getColorFromPPTX(run.highlight) : 'transparent',
                        letterSpacing: run.spacing ? `${run.spacing}px` : 'normal',
                        verticalAlign: run.baseline === 'superscript' ? 'super' : 
                                       run.baseline === 'subscript' ? 'sub' : 'baseline',
                        textTransform: run.caps === 'all' ? 'uppercase' : 
                                      run.caps === 'small' ? 'lowercase' : 'none',
                        whiteSpace: 'pre-wrap'
                      };
                      
                      return (
                        <span key={`r-${element.id}-${pIndex}-${rIndex}`} style={runStyle}>
                          {run.text}
                        </span>
                      );
                    }) : paragraph.text
                  }
                </p>
              );
            })}
          </div>
        );
      } else {
        // Fallback for simple text content
        return (
          <div
            key={element.id}
            className="absolute hover:outline-1 hover:outline hover:outline-blue-500 transition-colors"
            style={{
              ...baseStyle,
              padding: '8px',
              textAlign: (element as any).textAlign as any || 'left',
              whiteSpace: 'pre-wrap',
              border: 'none'
            }}
          >
            {element.content || 'Text element'}
          </div>
        );
      }
    }
    
    // Default for other element types
    return (
      <div
        key={element.id}
        className="absolute hover:outline-1 hover:outline hover:outline-blue-500 transition-colors"
        style={{
          ...baseStyle,
          padding: '0',
          textAlign: 'left',
          overflow: 'hidden'
        }}
      >
        {element.content || (
          <div className="flex items-center justify-center w-full h-full text-xs text-gray-500">
            {element.type}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-100">
      {/* Tools */}
      <div className="bg-white border-b border-gray-200 p-2 flex gap-2">
        <Button
          variant={selectedTool === 'text' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedTool(selectedTool === 'text' ? null : 'text')}
        >
          Add Text
        </Button>
        <Button
          variant={selectedTool === 'rectangle' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedTool(selectedTool === 'rectangle' ? null : 'rectangle')}
        >
          Rectangle
        </Button>
        <Button
          variant={selectedTool === 'circle' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedTool(selectedTool === 'circle' ? null : 'circle')}
        >
          Circle
        </Button>
        {/* Marine Corps styling is now auto-detected and applied during file upload */}
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-white shadow-lg" style={{ width: '800px', height: '600px' }}>
          {/* Slide Editor */}
          <div className="p-6 border-b border-gray-200 hidden">
            <Input
              value={slide.title}
              onChange={(e) => handleTitleEdit(e.target.value)}
              className="text-xl font-semibold border-none shadow-none p-0 h-auto focus-visible:ring-0 mb-2"
              placeholder="Slide title..."
            />
            
            {isEditing ? (
              <Textarea
                value={slide.content}
                onChange={(e) => handleContentEdit(e.target.value)}
                onBlur={() => setIsEditing(false)}
                className="resize-none border-none shadow-none p-0 focus-visible:ring-0"
                placeholder="Click to add content..."
                autoFocus
              />
            ) : (
              <div
                onClick={() => setIsEditing(true)}
                className="min-h-[100px] p-2 rounded cursor-text hover:bg-gray-50 transition-colors"
              >
                {slide.content || (
                  <span className="text-gray-400">Click to add content...</span>
                )}
              </div>
            )}
          </div>

          {/* Canvas Area */}
          <div
            className={cn(
              "relative flex-1 h-full overflow-hidden", // Removed visible border
              selectedTool && "cursor-crosshair"
            )}
            style={{
              position: 'relative', // Ensure positioning context
              ...(slide.background?.fill ? getBackgroundStyle(slide.background.fill) : { backgroundColor: slide.backgroundColor || '#ffffff' }),
            }}
            onClick={handleCanvasClick}
          >
            {/* Debug information */}
            <div className="absolute top-0 left-0 bg-white bg-opacity-70 p-1 z-50 text-xs">
              Slide ID: {slide.id} | Elements: {slide.elements.length}
            </div>
            
            {/* Render all slide elements */}
            {slide.elements && slide.elements.length > 0 ? (
              slide.elements.map(renderElement)
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                No elements on this slide. Use the tools above to add content.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
