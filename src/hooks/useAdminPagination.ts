import { useState } from "react";

const PAGE_SIZE = 10;

export function useAdminPagination<T>(rows: readonly T[] | undefined, scope = "") {
  const [selection, setSelection] = useState({ scope, page: 1 });
  const total = rows?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = selection.scope === scope ? Math.min(selection.page, pageCount) : 1;

  // Reset when filters change and keep the current page valid after a deletion.
  if (selection.scope !== scope || selection.page !== page) setSelection({ scope, page });

  return {
    rows: (rows ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    page, pageCount, total,
    start: total ? (page - 1) * PAGE_SIZE + 1 : 0,
    end: Math.min(page * PAGE_SIZE, total),
    onPageChange: (next: number) => setSelection({ scope, page: Math.max(1, Math.min(next, pageCount)) }),
  };
}
