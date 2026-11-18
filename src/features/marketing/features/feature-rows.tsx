import { LayoutDashboardIcon, LinkIcon, MessageCircleIcon, PaletteIcon, SmartphoneIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { OrderChat } from "@/features/marketing/shared/order-chat"
import { DashboardMock } from "./dashboard-mock"
import { DesignVisual } from "./design-visual"
import { FeatureGroup } from "./feature-group"
import { FeatureRow } from "./feature-row"
import { LinkVisual } from "./link-visual"
import { NoWebsiteStrip } from "./no-website-strip"
import { PhoneSpeed } from "./phone-speed"

/**
 * The detailed features, grouped by what the seller does. Row ids are the
 * targets of Home's "Learn more" links.
 */
export async function FeatureRows() {
  const t = await getTranslations("Features")
  const bullets = (prefix: "design" | "whatsapp" | "link" | "dashboard" | "phone") =>
    [t(`${prefix}Bullet1`), t(`${prefix}Bullet2`), t(`${prefix}Bullet3`)]

  return (
    <div className="px-4 py-10 md:py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 md:gap-28">
        <FeatureGroup number={1} label={t("groupSetUp")}>
          <FeatureRow
            id="design"
            tint
            icon={<PaletteIcon className="size-6" aria-hidden />}
            title={t("designRowTitle")}
            body={t("designDetail")}
            bullets={bullets("design")}
            visual={<DesignVisual />}
          />
          <FeatureRow
            id="link"
            reverse
            icon={<LinkIcon className="size-6" aria-hidden />}
            title={t("linkRowTitle")}
            body={t("linkDetail")}
            bullets={bullets("link")}
            visual={<LinkVisual />}
          />
          <NoWebsiteStrip />
        </FeatureGroup>

        <FeatureGroup number={2} label={t("groupSell")}>
          <FeatureRow
            id="whatsapp"
            icon={<MessageCircleIcon className="size-6" aria-hidden />}
            title={t("whatsappRowTitle")}
            body={t("whatsappDetail")}
            bullets={bullets("whatsapp")}
            visual={<OrderChat reply={{ text: t("chatReply"), time: t("chatReplyTime") }} />}
          />
          <FeatureRow
            id="phone"
            reverse
            icon={<SmartphoneIcon className="size-6" aria-hidden />}
            title={t("phoneRowTitle")}
            body={t("phoneDetail")}
            bullets={bullets("phone")}
            visual={<PhoneSpeed note={t("speedNote")} />}
          />
        </FeatureGroup>

        <FeatureGroup number={3} label={t("groupManage")}>
          <FeatureRow
            id="dashboard"
            icon={<LayoutDashboardIcon className="size-6" aria-hidden />}
            title={t("dashboardRowTitle")}
            body={t("dashboardDetail")}
            bullets={bullets("dashboard")}
            visual={<DashboardMock />}
          />
        </FeatureGroup>
      </div>
    </div>
  )
}
