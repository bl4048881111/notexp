import { Link } from "wouter";
import { Home, Users, FileText, Calendar, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MobileNavProps {
  onNavClick?: () => void;
}

export default function MobileNav({ onNavClick }: MobileNavProps) {
  const handleLinkClick = () => {
    if (onNavClick) {
      onNavClick();
    }
  };

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex flex-col gap-2 p-4">
        <div className="px-2 py-4">
          <h2 className="text-lg font-semibold">Menu</h2>
          <p className="text-sm text-muted-foreground">
            Navigazione principale
          </p>
        </div>
        
        <Link href="/">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLinkClick}
          >
            <Home className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        
        <Link href="/clients">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLinkClick}
          >
            <Users className="mr-2 h-4 w-4" />
            Clienti
          </Button>
        </Link>
        
        <Link href="/quotes">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLinkClick}
          >
            <FileText className="mr-2 h-4 w-4" />
            Preventivi
          </Button>
        </Link>
        
        <Link href="/appointments">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLinkClick}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Appuntamenti
          </Button>
        </Link>
        
        <Link href="/services">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLinkClick}
          >
            <Settings className="mr-2 h-4 w-4" />
            Servizi
          </Button>
        </Link>

        <div className="px-2 py-4 mt-4">
          <h2 className="text-lg font-semibold">Monitoraggio</h2>
          <p className="text-sm text-muted-foreground">
            Attività di sistema
          </p>
        </div>
        
        <Link href="/activity-logs">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLinkClick}
          >
            <Users className="mr-2 h-4 w-4" />
            Attività Utenti
          </Button>
        </Link>
        
        <Link href="/db-changes">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLinkClick}
          >
            <FileText className="mr-2 h-4 w-4" />
            Modifiche al Database
          </Button>
        </Link>
      </div>
    </ScrollArea>
  );
} 