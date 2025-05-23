import { useState, FormEvent, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "../hooks/useAuth";
import { useActivityLogger } from "../components/dev/ActivityLogger";
import autoExpressLogo from "../assets/logo.png";
import { authService } from "../services/authService";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const { login, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useActivityLogger();
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
      console.log('Utente già autenticato, reindirizzamento a:', path);
      setLocation(path);
    }
  }, [isAuthenticated, redirectPath, setLocation]);

  // Funzione per ottenere l'indirizzo IP dell'utente
  const getUserIP = async (): Promise<string> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn("Impossibile ottenere l'indirizzo IP:", error);
      return "non disponibile";
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Aggiungi un ritardo di 300ms per evitare problemi di race condition con Netlify
      setTimeout(async () => {
        const success = await login(username, password);
        
        if (success) {
          // Aggiungi un timestamp per evitare problemi di cache
          const timestamp = Date.now();
          sessionStorage.setItem('login_timestamp', timestamp.toString());
          
          // Reindirizza all'URL specificato o alla dashboard
          const path = redirectPath || '/dashboard';
          console.log('Login riuscito, reindirizzamento a:', path);
          
          // Breve timeout per assicurarsi che il localStorage sia aggiornato
          setTimeout(() => {
            setLocation(path);
          }, 100);
        } else {
          // Registra il tentativo di accesso fallito
          const ipAddress = await getUserIP();
          logActivity(
            'login_failed',
            `Tentativo di accesso fallito: ${username}`,
            {
              username,
              ipAddress,
              timestamp: new Date(),
              reason: 'Credenziali non valide'
            }
          );
          
          toast({
            title: "Errore di accesso",
            description: "Credenziali non valide.",
            variant: "destructive",
          });
          setIsLoading(false);
        }
      }, 300);
    } catch (error) {
      // Registra l'errore di accesso
      const ipAddress = await getUserIP();
      logActivity(
        'error',
        `Errore durante il tentativo di accesso`,
        {
          username,
          ipAddress,
          timestamp: new Date(),
          error: String(error)
        }
      );
      
      toast({
        title: "Errore di accesso",
        description: "Si è verificato un errore durante l'accesso.",
        variant: "destructive",
      });
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
              <span className="text-[#666666]">AUTOE</span>
              <span className="text-primary">X</span>
              <span className="text-[#666666]">PRESS</span>
            </h1>
            <p className="text-muted-foreground">Sistema di Gestione Officina</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Codice Cliente o Email</Label>
              <Input
                id="username"
                type="text"
                placeholder="Codice Cliente o Email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Password"
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
          
          {/*<div className="mt-4 text-center text-sm text-muted-foreground">
            <p>Sistema per la gestione dell'officina</p>
            <p className="mt-1">v1.0.0</p>
          </div>*/}
        </CardContent>
      </Card>
    </div>
  );
}
