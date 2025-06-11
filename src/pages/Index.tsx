
import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { SlideThumbnails } from '@/components/SlideThumbnails';
import { SlideCanvas } from '@/components/SlideCanvas';
import { Slide } from '@/types/slide';

const Index = () => {
  const [slides, setSlides] = useState<Slide[]>([
    {
      id: '1',
      title: 'Slide 1',
      content: 'Welcome to your presentation',
      backgroundColor: '#ffffff',
      elements: []
    }
  ]);
  const [currentSlideId, setCurrentSlideId] = useState('1');
  const [presentationTitle, setPresentationTitle] = useState('Untitled Presentation');

  const currentSlide = slides.find(slide => slide.id === currentSlideId);

  const addSlide = () => {
    const newSlide: Slide = {
      id: Date.now().toString(),
      title: `Slide ${slides.length + 1}`,
      content: '',
      backgroundColor: '#ffffff',
      elements: []
    };
    setSlides([...slides, newSlide]);
    setCurrentSlideId(newSlide.id);
  };

  const deleteSlide = (slideId: string) => {
    if (slides.length <= 1) return;
    
    const newSlides = slides.filter(slide => slide.id !== slideId);
    setSlides(newSlides);
    
    if (currentSlideId === slideId) {
      setCurrentSlideId(newSlides[0].id);
    }
  };

  const duplicateSlide = (slideId: string) => {
    const slideToClone = slides.find(slide => slide.id === slideId);
    if (!slideToClone) return;

    const newSlide: Slide = {
      ...slideToClone,
      id: Date.now().toString(),
      title: `${slideToClone.title} (Copy)`
    };

    const slideIndex = slides.findIndex(slide => slide.id === slideId);
    const newSlides = [...slides];
    newSlides.splice(slideIndex + 1, 0, newSlide);
    setSlides(newSlides);
    setCurrentSlideId(newSlide.id);
  };

  const updateSlide = (slideId: string, updates: Partial<Slide>) => {
    setSlides(slides.map(slide => 
      slide.id === slideId ? { ...slide, ...updates } : slide
    ));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header 
        presentationTitle={presentationTitle}
        onTitleChange={setPresentationTitle}
        onAddSlide={addSlide}
      />
      
      <div className="flex-1 flex">
        <SlideThumbnails
          slides={slides}
          currentSlideId={currentSlideId}
          onSlideSelect={setCurrentSlideId}
          onSlideDelete={deleteSlide}
          onSlideDuplicate={duplicateSlide}
        />
        
        <SlideCanvas
          slide={currentSlide}
          onSlideUpdate={updateSlide}
        />
      </div>
    </div>
  );
};

export default Index;
