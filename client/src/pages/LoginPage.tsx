import { useState, FormEvent, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "../contexts/AuthContext";
import autoExpressLogo from "../assets/logo.png";

export default function LoginPage() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Controlla se l'utente è già autenticato o se ci sono parametri di redirect
  useEffect(() => {
    // Recupera eventuali parametri di redirect dall'URL
    const searchParams = new URLSearchParams(window.location.search);
    const redirect = searchParams.get('redirect');
    if (redirect) {
      setRedirectPath(redirect);
    }

    // Se l'utente è già autenticato, reindirizza alla dashboard o al percorso specificato
    if (isAuthenticated) {
      const path = redirectPath || '/dashboard';
      //console.log('Utente già autenticato, reindirizzamento a:', path);
      setLocation(path);
    }
  }, [isAuthenticated, redirectPath, setLocation]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const success = await login(emailOrUsername, password);
      
      if (success) {
        // Reindirizza all'URL specificato o alla dashboard
        const path = redirectPath || '/dashboard';
        //console.log('Login riuscito, reindirizzamento a:', path);
        
        // Breve timeout per assicurarsi che lo stato sia aggiornato
        setTimeout(() => {
          setLocation(path);
        }, 100);
      } else {
        toast({
          title: "Errore di accesso",
          description: "Credenziali non valide.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Errore durante il login:', error);
      toast({
        title: "Errore di accesso",
        description: "Si è verificato un errore durante l'accesso.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="flex justify-center items-center w-24 h-24 rounded-lg bg-transparent">
                <img src={autoExpressLogo} alt="Logo AutoExpress" className="h-20 w-20 object-contain" />
              </div>
            </div>
            <h1 className="font-bold text-3xl mb-2">
              <span className="text-white">AUTOE</span>
              <span className="text-primary">X</span>
              <span className="text-white">PRESS</span>
            </h1>
            {/*   <p className="text-muted-foreground">Sistema di Gestione Officina</p> */}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="emailOrUsername">Email</Label>
              <Input
                id="emailOrUsername"
                type="text"
                placeholder="Inserisci la tua email"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Inserisci la password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Accesso in corso..." : "Accedi"}
            </Button>

            {redirectPath && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                Dopo il login sarai reindirizzato alla pagina richiesta.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
