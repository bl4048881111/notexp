import { useState } from "react";
import { repairAllQuotesClientNames } from "@shared/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check, AlertTriangle } from "lucide-react";

export function RepairTool() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairResults, setRepairResults] = useState<{ fixed: number, total: number } | null>(null);
  const { toast } = useToast();
  
  const handleRepairClick = async () => {
    if (isRepairing) return;
    
    try {
      setIsRepairing(true);
      toast({
        title: "Riparazione avviata",
        description: "Riparazione dei preventivi in corso...",
      });
      
      // Esegui la riparazione
      const results = await repairAllQuotesClientNames();
      setRepairResults(results);
      
      // Mostra toast di successo
      toast({
        title: "Riparazione completata",
        description: `${results.fixed} preventivi aggiornati su ${results.total} totali.`,
        variant: results.fixed > 0 ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Errore durante la riparazione:", error);
      toast({
        title: "Errore di riparazione",
        description: "Si è verificato un errore durante la riparazione dei preventivi.",
        variant: "destructive",
      });
    } finally {
      setIsRepairing(false);
    }
  };
  
  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Strumento di Riparazione Preventivi</CardTitle>
        <CardDescription>
          Questo strumento aggiorna i nomi dei clienti nei preventivi in base ai dati cliente più recenti.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Utilizza questo strumento quando noti che i nomi dei clienti nei preventivi non sono aggiornati correttamente dopo la modifica dei dati cliente.
        </p>
        
        {repairResults && (
          <div className={`p-4 rounded-md ${
            repairResults.fixed > 0 
              ? "bg-green-100 border border-green-200 text-green-800" 
              : "bg-yellow-100 border border-yellow-200 text-yellow-800"
          }`}>
            <div className="flex items-center gap-2">
              {repairResults.fixed > 0 
                ? <Check className="h-5 w-5 text-green-500" /> 
                : <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              <span className="font-medium">
                {repairResults.fixed > 0 
                  ? `${repairResults.fixed} preventivi aggiornati` 
                  : "Nessun preventivo da aggiornare"}
              </span>
            </div>
            <p className="text-sm mt-1">
              {repairResults.fixed > 0 
                ? `Sono stati riparati ${repairResults.fixed} preventivi su ${repairResults.total} totali.`
                : `Tutti i ${repairResults.total} preventivi sono già aggiornati.`}
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={handleRepairClick} 
          disabled={isRepairing}
          className="w-full"
        >
          {isRepairing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Riparazione in corso...
            </>
          ) : (
            "Ripara Preventivi"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
} 