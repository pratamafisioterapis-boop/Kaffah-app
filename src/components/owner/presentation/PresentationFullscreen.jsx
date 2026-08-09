import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';

const AUTOPLAY_INTERVAL_MS = 8000;

// Overlay fullscreen untuk mode presentasi — pola fixed inset-0 + framer-motion
// yang sama dengan drawer mobile di DashboardLayout.jsx, tapi menutupi seluruh
// viewport (termasuk sidebar) supaya cocok dipresentasikan ke layar besar.
const PresentationFullscreen = ({ slides, onClose }) => {
  const [api, setApi] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrentIndex(api.selectedScrollSnap());
    api.on('select', onSelect);
    onSelect();
    return () => api.off('select', onSelect);
  }, [api]);

  useEffect(() => {
    if (!api || !isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext();
      } else {
        api.scrollTo(0);
      }
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [api, isPlaying]);

  const handleClose = useCallback(() => {
    setIsPlaying(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleClose]);

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950"
      >
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #d4af6a 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 md:px-8 py-3 md:py-4">
          <div className="flex items-center gap-2 text-slate-300 text-xs md:text-sm font-semibold">
            Slide {currentIndex + 1} / {slides.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full bg-white/10 border-white/10 text-white hover:bg-white/20"
              onClick={() => setIsPlaying((p) => !p)}
              title={isPlaying ? 'Jeda otomatis' : 'Putar otomatis'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full bg-white/10 border-white/10 text-white hover:bg-white/20"
              onClick={handleClose}
              title="Keluar (Esc)"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Carousel setApi={setApi} className="h-full w-full" opts={{ loop: false }}>
          <CarouselContent className="h-screen -ml-0">
            {slides.map((slide, idx) => (
              <CarouselItem key={idx} className="h-screen pl-0 flex items-center justify-center">
                {slide}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Manual nav arrows */}
        <button
          onClick={() => api?.scrollPrev()}
          disabled={!api?.canScrollPrev()}
          className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/10 border border-white/10 text-white flex items-center justify-center disabled:opacity-30 hover:bg-white/20 transition-colors"
        >
          <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
        </button>
        <button
          onClick={() => api?.scrollNext()}
          disabled={!api?.canScrollNext()}
          className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 h-10 w-10 md:h-12 md:w-12 rounded-full bg-white/10 border border-white/10 text-white flex items-center justify-center disabled:opacity-30 hover:bg-white/20 transition-colors"
        >
          <ChevronRight className="h-5 w-5 md:h-6 md:w-6" />
        </button>

        {/* Progress dots */}
        <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => api?.scrollTo(idx)}
              className={`h-1.5 md:h-2 rounded-full transition-all ${idx === currentIndex ? 'w-6 md:w-8 bg-amber-300' : 'w-1.5 md:w-2 bg-white/30'}`}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default PresentationFullscreen;
