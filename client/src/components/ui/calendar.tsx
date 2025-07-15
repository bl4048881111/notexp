import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 bg-white rounded-md border border-gray-200", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 pb-2 relative items-center bg-white",
        caption_label: "text-sm font-medium text-gray-900",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "h-7 w-7 bg-white border border-gray-300 rounded p-0 hover:bg-gray-100 text-gray-600 hover:text-gray-900"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse bg-white",
        head_row: "flex bg-white",
        head_cell: "text-gray-500 w-9 font-normal text-xs uppercase text-center py-1 bg-white flex items-center justify-center",
        row: "flex w-full bg-white",
        cell: "h-9 w-9 text-center text-sm p-0 relative bg-white flex items-center justify-center",
        day: cn(
          "h-8 w-8 p-0 font-normal rounded hover:bg-orange-100 hover:text-orange-800 text-gray-700 bg-white flex items-center justify-center"
        ),
        day_range_end: "day-range-end",
        day_selected: "bg-orange-500 text-white hover:bg-orange-600",
        day_today: "bg-orange-500 text-white font-medium",
        day_outside: "text-gray-400 opacity-50",
        day_disabled: "text-gray-300 opacity-30",
        day_range_middle: "aria-selected:bg-orange-100 aria-selected:text-orange-800",
        day_hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
