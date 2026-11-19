import type { EventTemplateId } from "../../../../../convex/lib/looks/events"
import { announcement } from "./announcement"
import { announcementBold } from "./announcementBold"
import { backToSchool } from "./backToSchool"
import { blackFriday } from "./blackFriday"
import { christmas } from "./christmas"
import { eid } from "./eid"
import { mothersDay } from "./mothersDay"
import { newArrivals } from "./newArrivals"
import { newYear } from "./newYear"
import { restocked } from "./restocked"
import { sale } from "./sale"
import { valentines } from "./valentines"
import { womensDay } from "./womensDay"
import type { TemplateLayers } from "./types"

/** How each event template is drawn. A template in events.ts without a file here fails the typecheck. */
export const TEMPLATE_LAYERS: Record<EventTemplateId, TemplateLayers> = {
  sale,
  newArrivals,
  restocked,
  blackFriday,
  christmas,
  newYear,
  valentines,
  mothersDay,
  womensDay,
  eid,
  backToSchool,
  announcement,
  announcementBold,
}
