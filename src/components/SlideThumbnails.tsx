
import React from 'react';
import { Button } from '@/components/ui/button';
import { Copy, X } from 'lucide-react';
import { Slide } from '@/types/slide';
import { cn } from '@/lib/utils';

interface SlideThumbnailsProps {
  slides: Slide[];
  currentSlideId: string;
  onSlideSelect: (slideId: string) => void;
  onSlideDelete: (slideId: string) => void;
  onSlideDuplicate: (slideId: string) => void;
}

export const SlideThumbnails: React.FC<SlideThumbnailsProps> = ({
  slides,
  currentSlideId,
  onSlideSelect,
  onSlideDelete,
  onSlideDuplicate
}) => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Slides</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className={cn(
              "group relative bg-gray-50 rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-md",
              currentSlideId === slide.id && "ring-2 ring-blue-500 bg-blue-50"
            )}
            onClick={() => onSlideSelect(slide.id)}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">
                {index + 1}
              </span>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSlideDuplicate(slide.id);
                  }}
                >
                  <Copy className="w-3 h-3" />
                </Button>
                {slides.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSlideDelete(slide.id);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            
            <div 
              className="w-full h-20 rounded border-2 border-gray-200 mb-2 flex items-center justify-center text-xs text-gray-500"
              style={{ backgroundColor: slide.backgroundColor }}
            >
              {slide.content || 'Empty slide'}
            </div>
            
            <p className="text-xs text-gray-700 truncate">{slide.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
