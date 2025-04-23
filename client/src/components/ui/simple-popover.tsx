import React, { useState, useRef, useEffect } from 'react';
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

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calcola la posizione del popover in base all'allineamento
  const getContentStyles = (): React.CSSProperties => {
    if (!triggerRef.current) return {};
    
    const rect = triggerRef.current.getBoundingClientRect();
    let left = 0;
    
    if (align === 'start') {
      left = 0;
    } else if (align === 'center') {
      left = -(200 - rect.width) / 2;
    } else if (align === 'end') {
      left = -(200 - rect.width);
    }
    
    return {
      top: rect.height + 8,
      left
    };
  };

  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        onClick={() => handleOpenChange(!isOpen)}
      >
        {trigger}
      </div>
      
      {isOpen && (
        <div
          ref={contentRef}
          style={getContentStyles()}
          className={cn(
            "absolute z-50 min-w-[200px] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
            className
          )}
        >
          {content || children}
        </div>
      )}
    </div>
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