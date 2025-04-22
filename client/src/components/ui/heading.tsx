import { FileText, LayoutDashboard, Calendar, Users, FileSpreadsheet, Car, Settings } from "lucide-react";

interface HeadingProps {
  title: string;
  description: string;
  icon?: string;
}

export function Heading({ title, description, icon }: HeadingProps) {
  const renderIcon = () => {
    switch (icon) {
      case "dashboard":
        return <LayoutDashboard className="h-8 w-8 text-primary" />;
      case "appointments":
        return <Calendar className="h-8 w-8 text-primary" />;
      case "clients":
        return <Users className="h-8 w-8 text-primary" />;
      case "file-text":
        return <FileText className="h-8 w-8 text-primary" />;
      case "vehicles":
        return <Car className="h-8 w-8 text-primary" />;
      case "settings":
        return <Settings className="h-8 w-8 text-primary" />;
      default:
        return <FileSpreadsheet className="h-8 w-8 text-primary" />;
    }
  };

  return (
    <div className="flex items-center gap-4">
      {icon && renderIcon()}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}