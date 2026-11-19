/**
 * Links to one admin record: its list with the details drawer open
 * (`?open=<id>`). The only place these URLs are built.
 */
const openIn = (list: string) => (id: string) => `${list}?${new URLSearchParams({ open: id })}`

export const adminHref = {
  user: openIn("/admin/users"),
  shop: openIn("/admin/shops"),
  role: openIn("/admin/roles"),
  changeRequest: openIn("/admin/change-requests"),
  product: openIn("/admin/products"),
  payment: openIn("/admin/payments"),
}
