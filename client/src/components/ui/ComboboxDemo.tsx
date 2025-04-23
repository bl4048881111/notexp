import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { SimplePopover } from "@/components/ui/CustomUIComponents"

interface ComboboxDemoProps {
  items: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function ComboboxDemo({ items, value, onChange, placeholder = "Seleziona..." }: ComboboxDemoProps) {
  const [open, setOpen] = React.useState(false)

  const selectedItem = items.find((item) => item.value === value)

  return (
    <SimplePopover 
      open={open} 
      onOpenChange={setOpen}
      trigger={
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedItem ? selectedItem.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      }
      content={
        <div className="w-full p-0">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder={`Cerca ${placeholder.toLowerCase()}...`} 
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                }
              }}
            />
            <CommandEmpty>Nessun risultato trovato.</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-y-auto">
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.label}
                  onSelect={(currentValue) => {
                    const selectedItem = items.find(item => item.label === currentValue);
                    if (selectedItem) {
                      onChange(selectedItem.value);
                      setOpen(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </div>
      }
    />
  )
}