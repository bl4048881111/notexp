import { MouseEventHandler } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface QuickActionButtonProps {
  icon: string;
  label: string;
  onClick: MouseEventHandler<HTMLDivElement>;
}

export default function QuickActionButton({ icon, label, onClick }: QuickActionButtonProps) {
  return (
    <div 
      className="bg-card hover:bg-accent/50 p-4 rounded-lg flex flex-col items-center justify-center text-center transition-colors duration-200 border border-border cursor-pointer"
      onClick={onClick}
    >
      <span className="material-icons text-primary text-3xl mb-2">{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}
