"use client";

import { useState } from "react";
import { Filter, RotateCcw } from "lucide-react";

type Props = {
  categories?: string[];
  showPartFilter?: boolean;
  showGroupBy?: boolean;
  onFilter: (filters: {
    dateFrom: string;
    dateTo: string;
    category: string;
    groupBy: "week" | "month";
  }) => void;
};

const today = new Date().toISOString().split("T")[0];
const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0];

export default function ReportFilters({ categories = [], showGroupBy = false, onFilter }: Props) {
  const [dateFrom, setDateFrom] = useState(sixMonthsAgo);
  const [dateTo, setDateTo] = useState(today);
  const [category, setCategory] = useState("");
  const [groupBy, setGroupBy] = useState<"week" | "month">("month");

  const handleApply = () => onFilter({ dateFrom, dateTo, category, groupBy });

  const handleReset = () => {
    setDateFrom(sixMonthsAgo);
    setDateTo(today);
    setCategory("");
    setGroupBy("month");
    onFilter({ dateFrom: sixMonthsAgo, dateTo: today, category: "", groupBy: "month" });
  };

  return (
    <div className="report-filters">
      <div className="report-filters-inner">
        <div className="report-filter-group">
          <label className="form-label">From</label>
          <input
            id="filter-date-from"
            type="date"
            className="form-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="report-filter-group">
          <label className="form-label">To</label>
          <input
            id="filter-date-to"
            type="date"
            className="form-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        {categories.length > 0 && (
          <div className="report-filter-group">
            <label className="form-label">Category</label>
            <select
              id="filter-category"
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
        {showGroupBy && (
          <div className="report-filter-group">
            <label className="form-label">Group By</label>
            <select
              id="filter-group-by"
              className="form-select"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as "week" | "month")}
            >
              <option value="month">Monthly</option>
              <option value="week">Weekly</option>
            </select>
          </div>
        )}
        <div className="report-filter-actions">
          <button id="btn-apply-filter" className="btn btn-primary btn-sm" onClick={handleApply}>
            <Filter size={15} /> Apply
          </button>
          <button id="btn-reset-filter" className="btn btn-outline btn-sm" onClick={handleReset}>
            <RotateCcw size={15} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}
