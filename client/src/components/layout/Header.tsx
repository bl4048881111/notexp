import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import MobileNav from "@/components/layout/MobileNav";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export default function Header() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Aggiorna l'orario ogni minuto
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-background border-b border-border sticky top-0 z-40">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/">
            <a className="flex items-center space-x-2">
              <span className="font-bold text-xl text-primary">AutoeXpress</span>
            </a>
          </Link>
        </div>

        <nav className="hidden lg:flex items-center gap-6 text-sm">
          <Link href="/">
            <a className="text-foreground/90 transition-colors hover:text-foreground">Dashboard</a>
          </Link>
          <Link href="/clients">
            <a className="text-foreground/90 transition-colors hover:text-foreground">Clienti</a>
          </Link>
          <Link href="/quotes">
            <a className="text-foreground/90 transition-colors hover:text-foreground">Preventivi</a>
          </Link>
          <Link href="/appointments">
            <a className="text-foreground/90 transition-colors hover:text-foreground">Appuntamenti</a>
          </Link>
          <Link href="/services">
            <a className="text-foreground/90 transition-colors hover:text-foreground">Servizi</a>
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {/* Data e orario */}
          <div className="hidden md:flex flex-col items-end mr-4">
            <div className="text-sm font-medium text-primary">
              {format(currentTime, 'EEEE d MMMM yyyy', { locale: it })}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(currentTime, 'HH:mm')}
            </div>
          </div>
          
          {user && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-full w-8 h-8 p-0" 
                onClick={handleLogout}
                title="Logout"
              >
                <User className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" aria-label="Toggle Menu">
                {isMobileMenuOpen ? <X /> : <Menu />}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <MobileNav onNavClick={() => setIsMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
} 