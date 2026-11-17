import { getTranslations } from "next-intl/server"
import Image from "next/image"
import vanoMobile from "@/assets/images/brand/vano-mobile.png"

/** A CSS phone frame around the designed Vano shop screen. */
export async function PhoneMockup() {
  const t = await getTranslations("Landing")
  return (
    <figure className="relative w-[280px] rounded-[2.75rem] bg-ink p-2.5 shadow-lift sm:w-[320px] md:w-[360px] lg:w-[380px]">
      <div className="relative overflow-hidden rounded-[2.25rem] bg-background">
        <Image
          src={vanoMobile}
          alt={t("mockupLabel")}
          placeholder="blur"
          sizes="(min-width: 1024px) 360px, (min-width: 768px) 340px, (min-width: 640px) 300px, 260px"
          fetchPriority="high"
          loading="eager"
          className="block h-auto w-full"
        />
      </div>
    </figure>
  )
}
