import Image from "next/image"
import { cn } from "cn"
import whatsappIcon from "@/assets/images/icons/whatsapp.png"

/**
 * The WhatsApp mark on "Order on WhatsApp" buttons (see the assets README:
 * used only for ordering / chatting on WhatsApp). Decorative: the button's
 * label already says WhatsApp. Works in server and client components.
 */
export function WhatsAppIcon({ className }: { className?: string }) {
  return <Image src={whatsappIcon} alt="" width={20} height={20} aria-hidden className={cn("size-5 shrink-0", className)} />
}
