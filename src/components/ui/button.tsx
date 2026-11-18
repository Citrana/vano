import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Mobile-first: default / icon sizes are 44px tall on phones (tap target),
// 36px from md up. Border color and font weight live in each variant
// (not the base) so `buttonVariants()` without tailwind-merge never conflicts.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border bg-clip-padding text-sm whitespace-nowrap transition-all select-none focus-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary font-semibold text-primary-foreground hover:bg-primary/90",
        outline:
          "border-border-strong bg-card font-semibold text-foreground hover:border-foreground/60 hover:bg-muted aria-expanded:bg-muted",
        secondary:
          "border-transparent bg-secondary font-medium text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)]",
        ghost: "border-transparent font-medium hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        destructive:
          "border-transparent bg-destructive/10 font-medium text-destructive hover:bg-destructive/20 ",
        whatsapp: "border-transparent bg-whatsapp font-semibold text-white hover:bg-whatsapp/90",
        link: "border-transparent font-medium text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-1.5 px-4 md:h-9 md:px-3",
        sm: "h-9 gap-1 px-3 text-[0.8rem] md:h-8",
        lg: "h-12 gap-2 px-5 text-base md:h-11",
        icon: "size-11 md:size-9",
        "icon-sm": "size-9 md:size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
