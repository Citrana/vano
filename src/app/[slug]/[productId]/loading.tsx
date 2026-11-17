import { Skeleton } from "@/components/ui/skeleton"

export default function ProductLoading() {
  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 pt-4 md:grid-cols-2 md:gap-10 md:pt-8" aria-busy>
      <Skeleton className="aspect-[4/5] rounded-xl" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-9 w-32" />
        <div className="flex gap-2">
          <Skeleton className="size-11" />
          <Skeleton className="size-11" />
          <Skeleton className="size-11" />
        </div>
        <Skeleton className="h-12 w-full" />
      </div>
    </main>
  )
}
