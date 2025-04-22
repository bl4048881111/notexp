import React from "react";
import { 
  FileText, 
  Calendar, 
  Users, 
  Home, 
  User, 
  Settings,
  BarChart,
  Car,
  FileEdit,
  Clock,
  Wrench,
  ShoppingBag
} from "lucide-react";

interface HeadingProps {
  title: string;
  description: string;
  icon?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  "home": <Home className="h-10 w-10 text-primary" />,
  "dashboard": <BarChart className="h-10 w-10 text-primary" />,
  "clients": <Users className="h-10 w-10 text-primary" />,
  "client": <User className="h-10 w-10 text-primary" />,
  "appointments": <Calendar className="h-10 w-10 text-primary" />,
  "appointment": <Clock className="h-10 w-10 text-primary" />,
  "quotes": <FileEdit className="h-10 w-10 text-primary" />,
  "quote": <FileText className="h-10 w-10 text-primary" />,
  "vehicle": <Car className="h-10 w-10 text-primary" />,
  "vehicles": <Car className="h-10 w-10 text-primary" />,
  "settings": <Settings className="h-10 w-10 text-primary" />,
  "file-text": <FileText className="h-10 w-10 text-primary" />,
  "tools": <Wrench className="h-10 w-10 text-primary" />,
  "services": <Wrench className="h-10 w-10 text-primary" />,
  "parts": <ShoppingBag className="h-10 w-10 text-primary" />
};

export function Heading({ title, description, icon }: HeadingProps) {
  return (
    <div className="flex items-center gap-4">
      {icon && iconMap[icon] ? iconMap[icon] : <div className="w-10" />}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}