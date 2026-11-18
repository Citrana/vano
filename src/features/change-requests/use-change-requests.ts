"use client"

import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { api } from "../../../convex/_generated/api"

export type MyChangeRequests = FunctionReturnType<typeof api.changeRequests.mine>
export type SellerChangeRequest = MyChangeRequests["requests"][number]

/** The caller's change requests (one Convex subscription, shared by every field). */
export function useMyChangeRequests() {
  return useQuery(api.changeRequests.mine, {})
}
