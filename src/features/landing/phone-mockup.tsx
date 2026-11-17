import { getTranslations } from "next-intl/server"
import Image from "next/image"
import vanoMobile from "@/assets/images/brand/vano-mobile.png"

/** A CSS phone frame around the designed Vano shop screen. */
export async function PhoneMockup() {
  const t = await getTranslations("Landing")
  return (
    <figure className="relative w-[240px] rounded-[2.5rem] bg-ink p-2 shadow-lift sm:w-[260px] md:w-[280px] lg:w-[300px]">
      <div className="relative overflow-hidden rounded-[2rem] bg-background">
        <Image
          src={vanoMobile}
          alt={t("mockupLabel")}
          placeholder="blur"
          sizes="(min-width: 1024px) 284px, (min-width: 768px) 264px, (min-width: 640px) 244px, 224px"
          fetchPriority="high"
          loading="eager"
          className="block h-auto w-full"
        />
      </div>
    </figure>
  )
}
