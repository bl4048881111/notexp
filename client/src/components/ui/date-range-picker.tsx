import * as React from "react"
import { Calendar, Filter } from "lucide-react"
import { DateRange } from "react-day-picker"
import { format, parse, isValid } from "date-fns"
import { it } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface DatePickerWithRangeProps extends React.HTMLAttributes<HTMLDivElement> {
  date?: { from: Date | undefined; to: Date | undefined }
  onDateChange?: (date: { from: Date | undefined; to: Date | undefined }) => void
  placeholder?: string
}

const formatDateInput = (value: string) => {
  // Rimuovi tutti i caratteri non numerici
  const numbers = value.replace(/\D/g, '')
  
  // Applica la formattazione
  if (numbers.length <= 2) {
    return numbers
  } else if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`
  } else {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`
  }
}

export function DatePickerWithRange({
  className,
  date,
  onDateChange,
  placeholder = "Seleziona un intervallo",
}: DatePickerWithRangeProps) {
  const [fromDate, setFromDate] = React.useState<string>(
    date?.from ? format(date.from, "dd/MM/yyyy") : ""
  )
  const [toDate, setToDate] = React.useState<string>(
    date?.to ? format(date.to, "dd/MM/yyyy") : ""
  )

  React.useEffect(() => {
    setFromDate(date?.from ? format(date.from, "dd/MM/yyyy") : "")
    setToDate(date?.to ? format(date.to, "dd/MM/yyyy") : "")
  }, [date?.from, date?.to])

  const handleFromDateChange = (value: string) => {
    const formattedValue = formatDateInput(value)
    setFromDate(formattedValue)
  }

  const handleToDateChange = (value: string) => {
    const formattedValue = formatDateInput(value)
    setToDate(formattedValue)
  }

  const handleFilter = () => {
    let fromDateParsed = undefined
    let toDateParsed = undefined

    if (fromDate && fromDate.length === 10) {
      const parsed = parse(fromDate, "dd/MM/yyyy", new Date())
      if (isValid(parsed)) {
        fromDateParsed = parsed
      }
    }

    if (toDate && toDate.length === 10) {
      const parsed = parse(toDate, "dd/MM/yyyy", new Date())
      if (isValid(parsed)) {
        toDateParsed = parsed
      }
    }

    onDateChange?.({
      from: fromDateParsed,
      to: toDateParsed,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFilter()
    }
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-medium text-gray-700">Da:</span>
          <Input
            type="text"
            placeholder="dd/mm/yyyy"
            value={fromDate}
            onChange={(e) => handleFromDateChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-32 text-sm"
            maxLength={10}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">A:</span>
          <Input
            type="text"
            placeholder="dd/mm/yyyy"
            value={toDate}
            onChange={(e) => handleToDateChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-32 text-sm"
            maxLength={10}
          />
        </div>
        <Button
          onClick={handleFilter}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 h-9"
        >
          <Filter className="h-4 w-4 mr-1" />
          Filtra
        </Button>
      </div>
    </div>
  )
} 