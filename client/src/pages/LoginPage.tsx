import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "../hooks/useAuth";
import autoExpressLogo from "../assets/logo.png";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const success = await login(username, password);
      
      if (success) {
        setLocation("/dashboard");
      } else {
        toast({
          title: "Errore di accesso",
          description: "Credenziali non valide.",
          variant: "destructive",
        });
      }
    } catch (error) {
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
              <span className="text-[#666666]">AUTOE</span>
              <span className="text-primary">X</span>
              <span className="text-[#666666]">PRESS</span>
            </h1>
            <p className="text-muted-foreground">Sistema di Gestione Officina</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Username"
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
          </form>
          
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>Sistema per la gestione dell'officina</p>
            <p className="mt-1">v1.0.0</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
