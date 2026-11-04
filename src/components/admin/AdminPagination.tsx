import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useAdminPagination } from "@/hooks/useAdminPagination";

interface Props {
  label: string;
  pagination: Omit<ReturnType<typeof useAdminPagination>, "rows">;
}

export function AdminPagination({ label, pagination: p }: Props) {
  if (!p.total) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
      <p className="text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
        Showing {p.start}–{p.end} of {p.total} {label.toLowerCase()}
      </p>
      {p.pageCount > 1 && (
        <nav aria-label={`${label} pagination`} className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="icon" aria-label="First page" disabled={p.page === 1} onClick={() => p.onPageChange(1)}><ChevronFirst className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Previous page" disabled={p.page === 1} onClick={() => p.onPageChange(p.page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="px-1 text-sm text-foreground">Page {p.page} of {p.pageCount}</span>
          <Button type="button" variant="outline" size="icon" aria-label="Next page" disabled={p.page === p.pageCount} onClick={() => p.onPageChange(p.page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Last page" disabled={p.page === p.pageCount} onClick={() => p.onPageChange(p.pageCount)}><ChevronLast className="h-4 w-4" /></Button>
        </nav>
      )}
    </div>
  );
}
