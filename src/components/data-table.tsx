import type { ReactNode } from "react";

export type Column<T> = {
  head: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T extends object>({
  rows,
  columns,
  onRowClick,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card/95 backdrop-blur">
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            {columns.map((c, i) => (
              <th key={i} className={`px-3 py-2.5 font-medium ${c.className ?? ""}`}>
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-border last:border-0 ${onRowClick ? "cursor-pointer hover:bg-accent/50" : ""}`}
            >
              {columns.map((c, i) => (
                <td key={i} className={`px-3 py-2.5 ${c.className ?? ""}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
