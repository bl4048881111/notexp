import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

// SimpleTooltip è un componente che risolve il problema di React.Children.only
// fornendo un'alternativa al pattern asChild utilizzato nei componenti Radix UI

interface SimpleTooltipProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  align?: "center" | "start" | "end";
  alignOffset?: number;
  className?: string;
  delayDuration?: number;
}

export function SimpleTooltip({
  trigger,
  content,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset,
  className,
  delayDuration = 200
}: SimpleTooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <div className="inline-block">
          {trigger}
        </div>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={sideOffset}
            align={align}
            alignOffset={alignOffset}
            className={cn(
              "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
              className
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}