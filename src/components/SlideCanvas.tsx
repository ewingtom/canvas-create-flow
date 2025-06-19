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

  const renderElement = (element: SlideElement) => {
    console.log('Rendering element:', element);
    
    // Ensure valid dimensions and positions with fallbacks
    const x = typeof element.x === 'number' ? element.x : 0;
    const y = typeof element.y === 'number' ? element.y : 0;
    const width = typeof element.width === 'number' ? element.width : 100;
    const height = typeof element.height === 'number' ? element.height : 50;
    
    const baseStyle = {
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
      backgroundColor: element.backgroundColor || 'transparent',
      color: element.color || '#000000',
      fontSize: element.fontSize ? `${element.fontSize}px` : '16px',
      borderRadius: element.type === 'circle' ? '50%' : '4px',
      position: 'absolute' as 'absolute',
      border: '1px solid #ccc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
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
    
    if (element.type === 'rectangle') {
      return (
        <div
          key={element.id}
          className="absolute border border-solid border-transparent hover:border-blue-500 transition-colors"
          style={{
            ...baseStyle,
            backgroundColor: element.backgroundColor || '#3b82f6',
            zIndex: 10
          }}
        >
          {element.content}
        </div>
      );
    }
    
    if (element.type === 'circle') {
      return (
        <div
          key={element.id}
          className="absolute border border-solid border-transparent hover:border-blue-500 transition-colors rounded-full"
          style={{
            ...baseStyle,
            backgroundColor: element.backgroundColor || '#3b82f6',
            zIndex: 10
          }}
        />
      );
    }
    
    // Default for text and other types
    return (
      <div
        key={element.id}
        className="absolute border border-solid border-gray-400 hover:border-blue-500 transition-colors"
        style={{
          ...baseStyle,
          padding: element.type === 'text' ? '8px' : '0',
          textAlign: 'left',
          zIndex: 10
        }}
      >
        {element.content || element.type}
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
              "relative flex-1 h-full overflow-hidden border border-2 border-blue-300", // Added visible border
              selectedTool && "cursor-crosshair"
            )}
            style={{ 
              backgroundColor: slide.backgroundColor || '#ffffff',
              position: 'relative', // Ensure positioning context
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
