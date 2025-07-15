import { format } from 'date-fns';
import { it } from 'date-fns/locale';

/**
 * Formatta una data in modo sicuro, gestendo valori null/undefined/invalidi
 */
export const formatDateSafe = (
  date: string | Date | number | null | undefined, 
  formatString: string = 'dd/MM/yyyy',
  fallback: string = 'N/A'
): string => {
  if (!date) return fallback;
  
  try {
    let dateObj: Date;
    
    if (typeof date === 'number') {
      // Se è un timestamp, convertilo in Date
      dateObj = new Date(date);
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }
    
    // Verifica se la data è valida
    if (isNaN(dateObj.getTime())) {
      return fallback;
    }
    
    return format(dateObj, formatString, { locale: it });
  } catch (error) {
    // console.warn('Errore nella formattazione della data:', error);
    return fallback;
  }
};

/**
 * Verifica se una data è valida
 */
export const isValidDate = (date: string | Date | number | null | undefined): boolean => {
  if (!date) return false;
  
  try {
    let dateObj: Date;
    
    if (typeof date === 'number') {
      dateObj = new Date(date);
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }
    
    return !isNaN(dateObj.getTime());
  } catch {
    return false;
  }
};

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    return dateObj.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    // console.warn('Errore nella formattazione della data:', error);
    return '';
  }
} 