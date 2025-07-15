import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Immagini dell'officina (sostituire con quelle reali quando disponibili)
const images = [
  'https://i.ibb.co/2Yczr8pD/IMG-3217.jpg',
  'https://i.ibb.co/Kjm6V98z/IMG-3220.jpg',
  'https://i.ibb.co/YT0GKpHd/IMG-3219.jpg',
  'https://i.ibb.co/v6Vbd3Jn/IMG-3218.jpg'
];

const INTERVAL = 5000; // 5 secondi

const OfficinaCarousel: React.FC = () => {
  const [index, setIndex] = useState(0);
  const length = images.length;

  // Avanzamento automatico
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % length);
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [length]);

  const prevSlide = () => setIndex((prev) => (prev - 1 + length) % length);
  const nextSlide = () => setIndex((prev) => (prev + 1) % length);

  return (
    <div className="relative w-full h-[380px] sm:h-[500px] overflow-hidden rounded-2xl shadow-2xl group">
      {images.map((src, i) => (
        <img
          key={src}
          src={`${src}?auto=format&fit=crop&w=1600&q=80`}
          alt={`Officina ${i + 1}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      {/* Controlli */}
      <button
        onClick={prevSlide}
        className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-opacity opacity-0 group-hover:opacity-100"
        aria-label="Slide precedente"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-opacity opacity-0 group-hover:opacity-100"
        aria-label="Slide successiva"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Indicatori */}
      <div className="absolute bottom-3 w-full flex justify-center gap-2">
        {images.map((_, i) => (
          <span
            key={i}
            className={`block w-3 h-3 rounded-full ${
              i === index ? 'bg-orange-500' : 'bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default OfficinaCarousel; 