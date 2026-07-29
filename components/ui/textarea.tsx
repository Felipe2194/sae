import { cn } from "@/lib/utils"
import * as React from "react"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-16 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
