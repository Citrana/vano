"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { DayPicker, type DayPickerProps } from "react-day-picker"
import { cn } from "cn"

/**
 * A month calendar (react-day-picker v9) in the brand tokens: arrow keys
 * move between days, Enter picks. Range ends are ink (selected chips),
 * the days between them blush. Pass `timeZone` and `locale` from the caller.
 */
function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      className={cn("w-fit", className)}
      classNames={{
        months: "relative flex flex-col gap-4 md:flex-row",
        month: "flex flex-col gap-2",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous:
          "focus-ring inline-flex size-9 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40",
        button_next:
          "focus-ring inline-flex size-9 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40",
        month_caption: "flex h-9 items-center justify-center",
        caption_label: "text-sm font-semibold",
        month_grid: "border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-[0.7rem] font-medium text-muted-foreground",
        week: "mt-1 flex",
        day: "relative size-9 p-0 text-center text-sm",
        day_button:
          "focus-ring inline-flex size-9 items-center justify-center rounded-md tabular-nums hover:bg-muted aria-selected:hover:bg-transparent",
        today: "font-bold [&>button]:underline [&>button]:underline-offset-4",
        outside: "text-muted-foreground opacity-60",
        disabled: "text-muted-foreground opacity-40",
        selected: "bg-secondary",
        range_start: "rounded-l-md [&>button]:chip-selected",
        range_end: "rounded-r-md [&>button]:chip-selected",
        range_middle: "rounded-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClass }) =>
          orientation === "left" ? (
            <ChevronLeftIcon className={cn("size-4", chevronClass)} aria-hidden />
          ) : (
            <ChevronRightIcon className={cn("size-4", chevronClass)} aria-hidden />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }
