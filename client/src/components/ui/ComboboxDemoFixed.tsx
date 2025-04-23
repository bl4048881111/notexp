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
  const [filteredItems, setFilteredItems] = React.useState(items)
  const [inputValue, setInputValue] = React.useState("")

  const selectedItem = items.find((item) => item.value === value)

  // Funzione per gestire la ricerca
  const handleFilter = React.useCallback((value: string) => {
    setInputValue(value)
    if (value === '') {
      setFilteredItems(items)
      return
    }
    
    const lowercaseValue = value.toLowerCase()
    setFilteredItems(
      items.filter(item => item.label.toLowerCase().includes(lowercaseValue))
    )
  }, [items])

  // Reset filtro quando cambia la lista di items
  React.useEffect(() => {
    setFilteredItems(items)
  }, [items])

  // Previeni il comportamento di invio del form e reset
  const preventFormSubmission = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      // Mantieni il focus sul comando
      if (e.currentTarget.getElementsByTagName('input').length > 0) {
        e.currentTarget.getElementsByTagName('input')[0].focus()
      }
    }
  }

  return (
    <div className="relative w-full" onKeyDown={preventFormSubmission}>
      <SimplePopover 
        open={open} 
        onOpenChange={setOpen}
        trigger={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            onClick={(e) => {
              e.preventDefault() // Previene submit
              setOpen(!open)
            }}
          >
            {selectedItem ? selectedItem.label : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        }
        content={
          <div className="w-full p-0">
            <Command 
              className="rounded-lg border shadow-md"
              onKeyDown={(e) => {
                preventFormSubmission(e)
              }}
            >
              <CommandInput 
                placeholder={`Cerca ${placeholder.toLowerCase()}...`} 
                value={inputValue}
                onValueChange={handleFilter}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault()
                  }
                }}
              />
              <CommandEmpty>Nessun risultato trovato.</CommandEmpty>
              <CommandGroup className="max-h-60 overflow-y-auto">
                {filteredItems.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.label}
                    onSelect={(currentValue) => {
                      // Usa il valore originale, non quello visualizzato
                      const selectedItem = items.find(i => i.label.toLowerCase() === currentValue.toLowerCase())
                      if (selectedItem) {
                        onChange(selectedItem.value)
                        setOpen(false)
                        setInputValue("")
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        e.preventDefault()
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
    </div>
  )
}