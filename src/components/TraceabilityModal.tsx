"use client";

import { useState, useEffect, useMemo } from "react";
import Modal from "@/components/Modal";
import { formatCurrency, formatNumber, formatDate } from "@/lib/utils";
import {
  Package,
  MapPin,
  Search,
  Layers,
  Hash,
  Calendar,
  Loader2,
  BoxSelect,
} from "lucide-react";

/* ── Types ────────────────────────────────────────────── */

interface LocationItem {
  lot_id: number;
  lot_number: string;
  quantity: number;
  received_date: string;
  expiry_date: string | null;
  date_code: string | null;
  part_id: number;
  part_sku: string;
  part_name: string;
  category: string;
  unit: string;
  price: number;
}

interface LocationItemsResponse {
  location: { id: number; name: string; type: string; capacity: number };
  items: LocationItem[];
  summary: { uniqueParts: number; totalQuantity: number; lotCount: number };
}

interface PartLot {
  location_id: number;
  location_name: string;
  location_type: string;
  capacity: number;
  lot_id: number;
  lot_number: string;
  quantity: number;
  received_date: string;
  expiry_date: string | null;
  date_code: string | null;
}

interface PartLocationSummary {
  location_id: number;
  location_name: string;
  location_type: string;
  capacity: number;
  total_quantity: number;
  lot_count: number;
  utilization_percent: number;
}

interface PartLocationsResponse {
  part: { id: number; sku: string; name: string; category: string; unit: string; price: number };
  lots: PartLot[];
  locationSummaries: PartLocationSummary[];
  summary: { totalLocations: number; totalQuantity: number; lotCount: number };
}

/* ── Props ────────────────────────────────────────────── */

interface TraceabilityModalProps {
  mode: "location-items" | "part-locations";
  entityId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

/* ═══════════════════════════════════════════════════════
   TRACEABILITY MODAL
   Bidirectional: Location → Items  OR  Part → Locations
   ═══════════════════════════════════════════════════════ */
export default function TraceabilityModal({
  mode,
  entityId,
  isOpen,
  onClose,
}: TraceabilityModalProps) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [locData, setLocData] = useState<LocationItemsResponse | null>(null);
  const [partData, setPartData] = useState<PartLocationsResponse | null>(null);
  const [viewMode, setViewMode] = useState<"summary" | "lots">("summary");

  // Fetch data when modal opens
  useEffect(() => {
    if (!isOpen || !entityId) return;
    setSearch("");
    setViewMode("summary");

    const fetchData = async () => {
      setLoading(true);
      try {
        const url =
          mode === "location-items"
            ? `/api/locations/${entityId}/items`
            : `/api/parts/${entityId}/locations`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Fetch failed");
        const json = await res.json();
        if (mode === "location-items") {
          setLocData(json);
          setPartData(null);
        } else {
          setPartData(json);
          setLocData(null);
        }
      } catch {
        setLocData(null);
        setPartData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, entityId, mode]);

  // ── Location → Items view ──
  const filteredLocItems = useMemo(() => {
    if (!locData) return [];
    const q = search.toLowerCase();
    return locData.items.filter(
      (item) =>
        item.part_sku.toLowerCase().includes(q) ||
        item.part_name.toLowerCase().includes(q) ||
        item.lot_number.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [locData, search]);

  // ── Part → Locations view ──
  const filteredPartLots = useMemo(() => {
    if (!partData) return [];
    const q = search.toLowerCase();
    return partData.lots.filter(
      (lot) =>
        lot.location_name.toLowerCase().includes(q) ||
        lot.lot_number.toLowerCase().includes(q) ||
        lot.location_type.toLowerCase().includes(q)
    );
  }, [partData, search]);

  const filteredLocSummaries = useMemo(() => {
    if (!partData) return [];
    const q = search.toLowerCase();
    return partData.locationSummaries.filter(
      (ls) =>
        ls.location_name.toLowerCase().includes(q) ||
        ls.location_type.toLowerCase().includes(q)
    );
  }, [partData, search]);

  // ── Title ──
  const title =
    mode === "location-items"
      ? `📍 ${locData?.location?.name ?? "Location"} — Stored Items`
      : `📦 ${partData?.part?.sku ?? "Part"} — Storage Locations`;

  const getUtilColor = (pct: number) =>
    pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#10b981";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="trace-modal">
        {loading ? (
          <div className="trace-loading">
            <Loader2 className="spin" size={28} />
            <p>Loading traceability data…</p>
          </div>
        ) : mode === "location-items" && locData ? (
          <>
            {/* Summary Cards */}
            <div className="trace-summary-grid">
              <div className="trace-summary-card">
                <Package size={18} className="trace-icon info" />
                <div>
                  <span className="trace-summary-value">
                    {formatNumber(locData.summary.uniqueParts)}
                  </span>
                  <span className="trace-summary-label">Unique Parts</span>
                </div>
              </div>
              <div className="trace-summary-card">
                <Layers size={18} className="trace-icon purple" />
                <div>
                  <span className="trace-summary-value">
                    {formatNumber(locData.summary.totalQuantity)}
                  </span>
                  <span className="trace-summary-label">Total Qty</span>
                </div>
              </div>
              <div className="trace-summary-card">
                <Hash size={18} className="trace-icon success" />
                <div>
                  <span className="trace-summary-value">
                    {formatNumber(locData.summary.lotCount)}
                  </span>
                  <span className="trace-summary-label">Lots</span>
                </div>
              </div>
            </div>

            {/* Location type badge */}
            <div className="trace-entity-info">
              <span className="badge badge-default">{locData.location.type}</span>
              <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                Capacity: {formatNumber(locData.location.capacity)}
              </span>
            </div>

            {/* Search */}
            <div className="trace-search">
              <Search size={15} className="trace-search-icon" />
              <input
                className="form-input"
                placeholder="Search items, SKU, lot..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Items Table */}
            {filteredLocItems.length === 0 ? (
              <div className="trace-empty">
                <BoxSelect size={36} />
                <p>No items found at this location.</p>
              </div>
            ) : (
              <div className="trace-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Part Name</th>
                      <th>Lot #</th>
                      <th className="text-right">Qty</th>
                      <th>Expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLocItems.map((item) => (
                      <tr key={item.lot_id}>
                        <td className="font-mono font-semibold">{item.part_sku}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>{item.part_name}</div>
                          <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{item.category}</div>
                        </td>
                        <td className="font-mono" style={{ fontSize: "0.8rem" }}>
                          {item.lot_number}
                        </td>
                        <td className="text-right font-semibold">
                          {formatNumber(item.quantity)} {item.unit}
                        </td>
                        <td>
                          {item.expiry_date ? (
                            <span
                              className={`badge ${
                                new Date(item.expiry_date) <= new Date()
                                  ? "badge-danger"
                                  : "badge-default"
                              }`}
                            >
                              {formatDate(item.expiry_date)}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : mode === "part-locations" && partData ? (
          <>
            {/* Summary Cards */}
            <div className="trace-summary-grid">
              <div className="trace-summary-card">
                <MapPin size={18} className="trace-icon info" />
                <div>
                  <span className="trace-summary-value">
                    {formatNumber(partData.summary.totalLocations)}
                  </span>
                  <span className="trace-summary-label">Locations</span>
                </div>
              </div>
              <div className="trace-summary-card">
                <Layers size={18} className="trace-icon purple" />
                <div>
                  <span className="trace-summary-value">
                    {formatNumber(partData.summary.totalQuantity)}
                  </span>
                  <span className="trace-summary-label">Total Qty</span>
                </div>
              </div>
              <div className="trace-summary-card">
                <Hash size={18} className="trace-icon success" />
                <div>
                  <span className="trace-summary-value">
                    {formatNumber(partData.summary.lotCount)}
                  </span>
                  <span className="trace-summary-label">Lots</span>
                </div>
              </div>
            </div>

            {/* Part info */}
            <div className="trace-entity-info">
              <span className="font-mono font-semibold">{partData.part.sku}</span>
              <span className="badge badge-default">{partData.part.category}</span>
              <span className="text-muted" style={{ fontSize: "0.78rem" }}>
                {formatCurrency(partData.part.price)} / {partData.part.unit}
              </span>
            </div>

            {/* View Toggle + Search */}
            <div className="trace-toolbar">
              <div className="trace-view-toggle">
                <button
                  className={`trace-toggle-btn ${viewMode === "summary" ? "active" : ""}`}
                  onClick={() => setViewMode("summary")}
                >
                  Summary
                </button>
                <button
                  className={`trace-toggle-btn ${viewMode === "lots" ? "active" : ""}`}
                  onClick={() => setViewMode("lots")}
                >
                  Lot Detail
                </button>
              </div>
              <div className="trace-search">
                <Search size={15} className="trace-search-icon" />
                <input
                  className="form-input"
                  placeholder="Search locations, lots..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Summary View */}
            {viewMode === "summary" && (
              <>
                {filteredLocSummaries.length === 0 ? (
                  <div className="trace-empty">
                    <MapPin size={36} />
                    <p>This part is not stored in any location.</p>
                  </div>
                ) : (
                  <div className="trace-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Location</th>
                          <th>Type</th>
                          <th className="text-right">Qty Stored</th>
                          <th className="text-right">Lots</th>
                          <th style={{ minWidth: 120 }}>Utilization</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLocSummaries.map((ls) => (
                          <tr key={ls.location_id}>
                            <td className="font-semibold">{ls.location_name}</td>
                            <td>
                              <span className="badge badge-default">{ls.location_type}</span>
                            </td>
                            <td className="text-right font-semibold">
                              {formatNumber(ls.total_quantity)}
                            </td>
                            <td className="text-right">{ls.lot_count}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div
                                  style={{
                                    flex: 1,
                                    height: 6,
                                    background: "#e2e8f0",
                                    borderRadius: 3,
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${Math.min(ls.utilization_percent, 100)}%`,
                                      height: "100%",
                                      background: getUtilColor(ls.utilization_percent),
                                      borderRadius: 3,
                                      transition: "width 0.5s",
                                    }}
                                  />
                                </div>
                                <span
                                  style={{
                                    fontSize: "0.72rem",
                                    fontWeight: 600,
                                    color: getUtilColor(ls.utilization_percent),
                                    minWidth: 38,
                                    textAlign: "right",
                                  }}
                                >
                                  {ls.utilization_percent}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* Lot Detail View */}
            {viewMode === "lots" && (
              <>
                {filteredPartLots.length === 0 ? (
                  <div className="trace-empty">
                    <Hash size={36} />
                    <p>No lots found.</p>
                  </div>
                ) : (
                  <div className="trace-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Location</th>
                          <th>Lot #</th>
                          <th className="text-right">Qty</th>
                          <th>Received</th>
                          <th>Expiry</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPartLots.map((lot) => (
                          <tr key={lot.lot_id}>
                            <td className="font-semibold">{lot.location_name}</td>
                            <td className="font-mono" style={{ fontSize: "0.8rem" }}>
                              {lot.lot_number}
                            </td>
                            <td className="text-right font-semibold">
                              {formatNumber(lot.quantity)}
                            </td>
                            <td style={{ fontSize: "0.82rem" }}>
                              {formatDate(lot.received_date)}
                            </td>
                            <td>
                              {lot.expiry_date ? (
                                <span
                                  className={`badge ${
                                    new Date(lot.expiry_date) <= new Date()
                                      ? "badge-danger"
                                      : "badge-default"
                                  }`}
                                >
                                  {formatDate(lot.expiry_date)}
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="trace-empty">
            <BoxSelect size={36} />
            <p>No data available.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
