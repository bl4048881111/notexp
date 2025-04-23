import React from 'react';
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Questo file contiene componenti UI personalizzati che
 * evitano l'uso di React.Children.only() e dei wrapper
 * che causano errori di compatibilità o problemi di rendering.
 */

// === POPOVER PERSONALIZZATO ===
interface SimplePopoverProps {
  children?: React.ReactNode;
  trigger: React.ReactNode;
  content?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SimplePopover({ 
  children, 
  trigger,
  content, 
  align = 'center',
  className,
  open,
  onOpenChange
}: SimplePopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  
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
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && 
          contentRef.current && 
          !contentRef.current.contains(event.target as Node) &&
          triggerRef.current && 
          !triggerRef.current.contains(event.target as Node)) {
        handleOpenChange(false);
      }
    };

    // Previene il refresh quando si usa il tasto Invio nel calendario
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Enter') {
        event.preventDefault();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
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

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Previene il submit del form
    handleOpenChange(!isOpen);
  };

  return (
    <div className="relative inline-block w-full">
      <div
        ref={triggerRef}
        onClick={handleTriggerClick}
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
          onClick={(e) => e.stopPropagation()} // Evita che i click vengano propagati
        >
          {content || children}
        </div>
      )}
    </div>
  );
}

// === DROPDOWN PERSONALIZZATO ===
interface SimpleDropdownProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

export function SimpleDropdown({ 
  trigger, 
  content, 
  align = 'end',
  className
}: SimpleDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Gestisce il click fuori dal dropdown per chiuderlo
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && 
          contentRef.current && 
          !contentRef.current.contains(event.target as Node) &&
          triggerRef.current && 
          !triggerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calcola la posizione in base all'allineamento
  const getContentStyles = (): React.CSSProperties => {
    if (!triggerRef.current) return {};
    
    const rect = triggerRef.current.getBoundingClientRect();
    let horizontalPosition: React.CSSProperties = {};
    
    if (align === 'start') {
      horizontalPosition = { left: 0 };
    } else if (align === 'center') {
      horizontalPosition = { 
        left: '50%', 
        transform: 'translateX(-50%)' 
      };
    } else if (align === 'end') {
      horizontalPosition = { right: 0 };
    }
    
    return {
      top: rect.height + 8,
      ...horizontalPosition
    };
  };

  return (
    <div className="relative inline-block">
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
      >
        {trigger}
      </div>
      
      {isOpen && (
        <div
          ref={contentRef}
          style={getContentStyles()}
          className={cn(
            "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export interface DropdownMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function DropdownMenuItem({ 
  children, 
  onClick, 
  className,
  disabled = false
}: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full text-left",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// === TOOLTIP PERSONALIZZATO ===
interface SimpleTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function SimpleTooltip({ 
  children, 
  content, 
  side = 'top',
  className
}: SimpleTooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const childRef = React.useRef<HTMLDivElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Calcola la posizione del tooltip in base al lato
  const getTooltipStyles = (): React.CSSProperties => {
    if (!childRef.current || !tooltipRef.current) return {};
    
    const childRect = childRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    
    let top = 0;
    let left = 0;
    
    switch (side) {
      case 'top':
        top = -tooltipRect.height - 8;
        left = (childRect.width - tooltipRect.width) / 2;
        break;
      case 'right':
        top = (childRect.height - tooltipRect.height) / 2;
        left = childRect.width + 8;
        break;
      case 'bottom':
        top = childRect.height + 8;
        left = (childRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = (childRect.height - tooltipRect.height) / 2;
        left = -tooltipRect.width - 8;
        break;
    }
    
    return { top, left };
  };

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 300);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative inline-block">
      <div
        ref={childRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          ref={tooltipRef}
          style={getTooltipStyles()}
          className={cn(
            "absolute z-50 max-w-xs px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95",
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}