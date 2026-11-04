import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useAdminPagination } from "./useAdminPagination";

afterEach(cleanup);

describe("Admin pagination", () => {
  it("pages through every record in groups of ten without overlaps", () => {
    const rows = Array.from({ length: 23 }, (_, i) => i + 1);
    const { result } = renderHook(() => useAdminPagination(rows));
    expect(result.current.rows).toEqual(rows.slice(0, 10));
    act(() => result.current.onPageChange(2));
    expect(result.current.rows).toEqual(rows.slice(10, 20));
    act(() => result.current.onPageChange(3));
    expect(result.current.rows).toEqual([21, 22, 23]);
    expect(result.current).toMatchObject({ start: 21, end: 23, total: 23, pageCount: 3 });
  });
  it("resets when filters or the selected attendance session change", () => {
    const rows = Array.from({ length: 30 }, (_, i) => i);
    const { result, rerender } = renderHook(({ scope }) => useAdminPagination(rows, scope), { initialProps: { scope: "all" } });
    act(() => result.current.onPageChange(3));
    rerender({ scope: "pending" });
    expect(result.current.page).toBe(1);
    act(() => result.current.onPageChange(2));
    expect(result.current.page).toBe(2);
    rerender({ scope: "all" });
    expect(result.current.page).toBe(1);
  });
  it("keeps pagination valid when the last row is removed and handles empty data", () => {
    const rows = Array.from({ length: 11 }, (_, i) => i);
    const { result, rerender } = renderHook(({ rows }) => useAdminPagination(rows), { initialProps: { rows } });
    act(() => result.current.onPageChange(2));
    rerender({ rows: rows.slice(0, 10) });
    expect(result.current.page).toBe(1);
    rerender({ rows: [] });
    expect(result.current).toMatchObject({ page: 1, rows: [], start: 0, end: 0, total: 0 });
    act(() => result.current.onPageChange(0));
    expect(result.current.page).toBe(1);
  });
});
