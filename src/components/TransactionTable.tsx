"use client";

import { useState, useMemo } from "react";
import { formatDateTime, getTransactionTypeInfo } from "@/lib/utils";
import type { TransactionDetail } from "@/types";
import { ArrowUpDown } from "lucide-react";
import EmptyState from "./EmptyState";

interface TransactionTableProps {
  transactions: TransactionDetail[];
  title?: string;
  showSearch?: boolean;
  pageSize?: number;
}

type SortField = "created_at" | "part_sku" | "transaction_type" | "quantity";

/**
 * Sortable, searchable, paginated transaction table.
 */
export default function TransactionTable({
  transactions,
  title = "Recent Transactions",
  showSearch = true,
  pageSize = 10,
}: TransactionTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transactions.filter(
      (t) =>
        t.part_sku?.toLowerCase().includes(q) ||
        t.part_name?.toLowerCase().includes(q) ||
        t.transaction_type?.toLowerCase().includes(q) ||
        t.user_name?.toLowerCase().includes(q) ||
        t.lot_number?.toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "created_at":
          cmp =
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime();
          break;
        case "part_sku":
          cmp = (a.part_sku || "").localeCompare(b.part_sku || "");
          break;
        case "transaction_type":
          cmp = a.transaction_type.localeCompare(b.transaction_type);
          break;
        case "quantity":
          cmp = a.quantity - b.quantity;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const pageData = sorted.slice((page - 1) * pageSize, page * pageSize);

  if (transactions.length === 0) {
    return (
      <div className="table-container">
        <div className="table-header">
          <h2>{title}</h2>
        </div>
        <EmptyState
          title="No Transactions Yet"
          message="Transaction history will appear here once stock is received or issued."
        />
      </div>
    );
  }

  return (
    <div className="table-container">
      <div className="table-header">
        <h2>{title}</h2>
        {showSearch && (
          <div className="table-actions">
            <input
              type="text"
              placeholder="Search transactions..."
              className="search-input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort("created_at")}>
                Date <ArrowUpDown size={12} className={`sort-icon ${sortField === "created_at" ? "active" : ""}`} />
              </th>
              <th onClick={() => handleSort("part_sku")}>
                Part <ArrowUpDown size={12} className={`sort-icon ${sortField === "part_sku" ? "active" : ""}`} />
              </th>
              <th onClick={() => handleSort("transaction_type")}>
                Type <ArrowUpDown size={12} className={`sort-icon ${sortField === "transaction_type" ? "active" : ""}`} />
              </th>
              <th onClick={() => handleSort("quantity")}>
                Qty <ArrowUpDown size={12} className={`sort-icon ${sortField === "quantity" ? "active" : ""}`} />
              </th>
              <th>Location</th>
              <th>Lot</th>
              <th>User</th>
              <th>FEFO</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((t) => {
              const typeInfo = getTransactionTypeInfo(t.transaction_type);
              return (
                <tr key={t.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {formatDateTime(t.created_at)}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>
                      {t.part_sku}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {t.part_name}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${typeInfo.colorClass}`}>
                      {typeInfo.label}
                    </span>
                  </td>
                  <td className="font-semibold">{t.quantity}</td>
                  <td>
                    {t.from_location_name && (
                      <span className="text-muted">
                        {t.from_location_name}
                        {t.to_location_name ? " → " : ""}
                      </span>
                    )}
                    {t.to_location_name && <span>{t.to_location_name}</span>}
                  </td>
                  <td className="font-mono" style={{ fontSize: "0.8rem" }}>
                    {t.lot_number || "—"}
                  </td>
                  <td>{t.user_name}</td>
                  <td>
                    {t.is_fefo_override ? (
                      <span className="badge badge-fefo-override" title={t.reason || ""}>
                        Override
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="table-pagination">
          <span>
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="pagination-buttons">
            <button
              className="pagination-btn"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const p = i + 1;
              return (
                <button
                  key={p}
                  className={`pagination-btn ${page === p ? "active" : ""}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              );
            })}
            <button
              className="pagination-btn"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
