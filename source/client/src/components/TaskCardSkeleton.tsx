import { Skeleton } from '@/components/ui/skeleton';

export function TaskCardSkeleton() {
  return (
    <div className="bg-white/[0.06] rounded-lg border border-l-4 border-l-white/[0.08] p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 flex-1" />
      </div>
      <Skeleton className="h-3 w-3/4" />
      <div className="flex gap-1">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>
    </div>
  );
}

export function KanbanColumnSkeleton() {
  return (
    <div className="flex-shrink-0 w-80 flex flex-col">
      <div className="bg-white/[0.06] rounded-t-xl border border-b-0 p-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-3 h-3 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-8 rounded-full ml-auto" />
        </div>
      </div>
      <div className="flex-1 bg-white/[0.05] rounded-b-xl border border-t-0 p-2 space-y-2 min-h-[200px]">
        <TaskCardSkeleton />
        <TaskCardSkeleton />
        <TaskCardSkeleton />
      </div>
    </div>
  );
}

export function TaskListSkeleton() {
  return (
    <div className="bg-white/[0.06] rounded-xl border shadow-sm overflow-hidden">
      <div className="grid grid-cols-[1fr_120px_100px_120px_100px_100px] gap-4 px-4 py-3 border-b bg-white/[0.03]">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_120px_100px_120px_100px_100px] gap-4 px-4 py-3 border-b"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}
