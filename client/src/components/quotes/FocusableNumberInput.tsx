import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

// Store globale per i valori - NON causa re-render
const globalSummaryStore: Record<string, number> = {};

// Funzione globale per forzare l'aggiornamento dei valori
export const forceUpdateInputValues = (updates: Record<string, number>) => {
  Object.entries(updates).forEach(([id, value]) => {
    globalSummaryStore[id] = value;
    
    // Trova l'input nel DOM e aggiorna il valore
    const inputElement = document.getElementById(id) as HTMLInputElement;
    if (inputElement) {
      // FIX FRECCE: Forza l'aggiornamento del valore anche se le frecce sono attive
      inputElement.value = value.toString();
      
      // Forza il blur per assicurarsi che il valore sia visibile
      inputElement.blur();
      
      // Dispara sia l'evento input che change per maggiore compatibilità
      const inputEvent = new Event('input', { bubbles: true });
      const changeEvent = new Event('change', { bubbles: true });
      
      inputElement.dispatchEvent(inputEvent);
      inputElement.dispatchEvent(changeEvent);
      
      console.log(`🔄 Valore forzato per ${id}:`, value);
    }
  });
};

// Componente separato per input numerici per evitare perdita di focus
export default function FocusableNumberInput({ 
  id,
  value,
  onChange,
  className,
  min,
  step,
  max
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: number;
  step?: number;
  max?: number;
}) {
  const [localValue, setLocalValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  
  // Aggiorna i ref senza causare re-render
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  
  // Aggiorna il valore locale solo se l'input non ha il focus
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(value.toString());
    }
  }, [value]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    // Parsing migliorato che gestisce correttamente il valore 0
    let numericValue = parseFloat(newValue);
    
    // Se il parsing fallisce (NaN), usa il valore minimo o 0
    if (isNaN(numericValue)) {
      numericValue = min !== undefined ? min : 0;
    }
    // Se il valore è sotto il minimo, usa il minimo
    else if (min !== undefined && numericValue < min) {
      numericValue = min;
    }
    // Se il valore è sopra il massimo, usa il massimo
    else if (max !== undefined && numericValue > max) {
      numericValue = max;
    }
    
    // Aggiorna SOLO lo store globale - nessuna callback al padre
    globalSummaryStore[id] = numericValue;
    
    // FIX FRECCE: Salva immediatamente anche quando si usano le frecce
    // Questo garantisce che l'aggiornamento sia visibile subito
    if (e.target.validity.valid) {
      onChangeRef.current(numericValue);
    }
  };
  
  // FIX FRECCE: Gestione specifica per gli eventi delle frecce (spinner)
  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    const newValue = target.value;
    setLocalValue(newValue);
    
    // Parsing del valore
    let numericValue = parseFloat(newValue);
    
    if (isNaN(numericValue)) {
      numericValue = min !== undefined ? min : 0;
    }
    else if (min !== undefined && numericValue < min) {
      numericValue = min;
    }
    else if (max !== undefined && numericValue > max) {
      numericValue = max;
    }
    
    // Aggiorna lo store e salva immediatamente
    globalSummaryStore[id] = numericValue;
    onChangeRef.current(numericValue);
    
    console.log(`🎯 Valore aggiornato tramite frecce per ${id}:`, numericValue);
  };
  
  // Salva nel database solo quando perde il focus
  const handleBlur = () => {
    // Parsing migliorato che gestisce correttamente il valore 0
    let numericValue = parseFloat(localValue);
    
    // Se il parsing fallisce (NaN), usa il valore minimo o 0
    if (isNaN(numericValue)) {
      numericValue = min !== undefined ? min : 0;
    }
    // Se il valore è sotto il minimo, usa il minimo
    else if (min !== undefined && numericValue < min) {
      numericValue = min;
    }
    // Se il valore è sopra il massimo, usa il massimo
    else if (max !== undefined && numericValue > max) {
      numericValue = max;
    }
    
    // Aggiorna il campo input con il valore corretto
    setLocalValue(numericValue.toString());
    
    // Salva nel database
    onChangeRef.current(numericValue);
  };
  
  // Gestione migliorata per Firefox - salva anche su Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
      // Forza il blur per compatibilità con Firefox
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }
  };
  
  return (
    <Input
      ref={inputRef}
      id={id}
      type="number"
      value={localValue}
      onChange={handleChange}
      onInput={handleInput}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      min={min}
      step={step}
      max={max}
      autoComplete="off"
      autoCorrect="off"
      spellCheck="false"
    />
  );
}

// Esporta anche lo store per l'uso in altri componenti
export { globalSummaryStore }; 