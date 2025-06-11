
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

  const handleTitleEdit = (title: string) => {
    onSlideUpdate(slide.id, { title });
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
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-white shadow-lg" style={{ width: '800px', height: '600px' }}>
          {/* Slide Editor */}
          <div className="p-6 border-b border-gray-200">
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
              "relative flex-1 h-96 overflow-hidden",
              selectedTool && "cursor-crosshair"
            )}
            style={{ backgroundColor: slide.backgroundColor }}
            onClick={handleCanvasClick}
          >
            {slide.elements.map((element) => (
              <div
                key={element.id}
                className="absolute border border-dashed border-gray-400 hover:border-blue-500 transition-colors"
                style={{
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                  backgroundColor: element.backgroundColor,
                  color: element.color,
                  fontSize: element.fontSize,
                  borderRadius: element.type === 'circle' ? '50%' : '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: element.type === 'text' ? '8px' : '0'
                }}
              >
                {element.content}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
