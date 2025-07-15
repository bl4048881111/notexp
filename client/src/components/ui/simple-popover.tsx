import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SimplePopoverProps {
  children?: React.ReactNode;
  trigger: React.ReactNode;
  content?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Un componente Popover semplificato che non utilizza React.Children.only
 * ed evita problemi con la nidificazione dei componenti
 * Versione migliorata con Portal per evitare problemi di overflow
 */
export function SimplePopover({ 
  children, 
  trigger,
  content, 
  align = 'center',
  className,
  open,
  onOpenChange
}: SimplePopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Usa il valore controllato (open) se fornito, altrimenti usa lo stato interno
  const isOpen = open !== undefined ? open : internalOpen;
  
  // Funzione per gestire i cambiamenti di stato
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  // Calcola la posizione ottimale del popover
  const calculatePosition = () => {
    if (!triggerRef.current) return { top: 0, left: 0 };
    
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Dimensioni ancora più grandi per il calendario con spaziatura extra
    const contentWidth = 520; // Aumentato per il calendario con più spaziatura
    const contentHeight = 580; // Aumentato per il calendario con più spaziatura
    
    let top = triggerRect.bottom + 12; // Più spazio dal trigger
    let left = triggerRect.left;
    
    // Calcola la posizione orizzontale in base all'allineamento
    if (align === 'center') {
      left = triggerRect.left + (triggerRect.width / 2) - (contentWidth / 2);
    } else if (align === 'end') {
      left = triggerRect.right - contentWidth;
    }
    
    // Assicurati che il popover non esca dal viewport orizzontalmente
    if (left + contentWidth > viewportWidth - 20) {
      left = viewportWidth - contentWidth - 20;
    }
    if (left < 20) {
      left = 20;
    }
    
    // Assicurati che il popover non esca dal viewport verticalmente
    if (top + contentHeight > viewportHeight - 20) {
      // Se non c'è spazio sotto, posiziona sopra il trigger
      top = triggerRect.top - contentHeight - 12;
      
      // Se neanche sopra c'è spazio, posiziona al centro dello schermo
      if (top < 20) {
        top = Math.max(20, (viewportHeight - contentHeight) / 2);
      }
    }
    
    return { top, left };
  };

  // Aggiorna la posizione quando il popover si apre
  useEffect(() => {
    if (isOpen) {
      const newPosition = calculatePosition();
      setPosition(newPosition);
    }
  }, [isOpen, align]);

  // Gestisce il click fuori dal popover per chiuderlo
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && 
          contentRef.current && 
          !contentRef.current.contains(event.target as Node) &&
          triggerRef.current && 
          !triggerRef.current.contains(event.target as Node)) {
        handleOpenChange(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape') {
        handleOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Aggiorna la posizione quando la finestra viene ridimensionata
  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        const newPosition = calculatePosition();
        setPosition(newPosition);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, align]);

  const popoverContent = isOpen ? (
    <div
      ref={contentRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999, // Z-index molto alto per assicurarsi che sia sopra tutto
      }}
      className={cn(
        "min-w-[520px] rounded-md border bg-popover p-2 text-popover-foreground shadow-lg outline-none",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        className
      )}
    >
      {content || children}
    </div>
  ) : null;

  return (
    <>
      <div className="relative inline-block">
        <div
          ref={triggerRef}
          onClick={() => handleOpenChange(!isOpen)}
        >
          {trigger}
        </div>
      </div>
      
      {/* Usa createPortal per renderizzare il popover nel body */}
      {popoverContent && createPortal(popoverContent, document.body)}
    </>
  );
}

export function SimplePopoverTrigger({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SimplePopoverContent({ 
  children,
  className
}: { 
  children: React.ReactNode,
  className?: string
}) {
  return (
    <div className={cn("w-auto", className)}>
      {children}
    </div>
  );
}