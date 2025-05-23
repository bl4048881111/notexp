import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  // Non mostrare paginazione se c'è solo una pagina
  if (totalPages <= 1) return null;

  // Genera array di numeri di pagina da visualizzare
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5; // Massimo numero di pagine da mostrare
    
    if (totalPages <= maxVisiblePages) {
      // Se abbiamo meno pagine del massimo, mostriamo tutte
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Strategia: mostra sempre la prima, l'ultima e alcune pagine attorno alla corrente
      
      // Aggiungi la prima pagina
      pageNumbers.push(1);
      
      // Calcola quante pagine mostrare prima e dopo la pagina corrente
      const leftOffset = Math.max(0, Math.min(2, currentPage - 2));
      const rightOffset = Math.max(0, Math.min(2, totalPages - currentPage - 1));
      
      // Aggiungi ellipsis se necessario a sinistra
      if (currentPage - leftOffset > 2) {
        pageNumbers.push('...');
      }
      
      // Aggiungi pagine attorno alla corrente
      for (let i = currentPage - leftOffset; i <= currentPage + rightOffset; i++) {
        if (i > 1 && i < totalPages) {
          pageNumbers.push(i);
        }
      }
      
      // Aggiungi ellipsis se necessario a destra
      if (currentPage + rightOffset < totalPages - 1) {
        pageNumbers.push('...');
      }
      
      // Aggiungi l'ultima pagina
      if (totalPages > 1) {
        pageNumbers.push(totalPages);
      }
    }
    
    return pageNumbers;
  };

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-2 mt-1 text-sm ml-1">
      <span className="text-muted-foreground mr-2">
        Pagina {currentPage} di {totalPages}
      </span>
      
      <div className="flex flex-wrap items-center gap-1">
        {/* Pulsante pagina precedente */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-7 w-7 p-0"
        >
          <span className="sr-only">Pagina precedente</span>
          <ChevronLeft className="h-3 w-3" />
        </Button>
        
        {/* Pulsanti numeri di pagina */}
        {getPageNumbers().map((page, index) => (
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="px-1">...</span>
          ) : (
            <Button
              key={`page-${page}`}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page as number)}
              className="h-7 w-7 p-0"
            >
              {page}
            </Button>
          )
        ))}
        
        {/* Pulsante pagina successiva */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-7 w-7 p-0"
        >
          <span className="sr-only">Pagina successiva</span>
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
} 