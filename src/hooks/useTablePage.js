import { useMemo, useState } from "react";

/**
 * Paging for a DataTable footer: "Rows per page", "Page 1 of 5", previous and
 * next. Goes back to page one when the filtered rows change length, so a new
 * search never lands on an empty page.
 */
export default function useTablePage(items, initialSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  const [seen, setSeen] = useState(items.length);
  if (items.length !== seen) {
    setSeen(items.length);
    setPage(1);
  }
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize]
  );
  return {
    visible,
    page: current,
    pageCount,
    pageSize,
    total: items.length,
    onPage: setPage,
    onPageSize: (size) => {
      setPageSize(size);
      setPage(1);
    },
  };
}
