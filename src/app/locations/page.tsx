"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import Modal from "@/components/Modal";
import TraceabilityModal from "@/components/TraceabilityModal";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { formatNumber } from "@/lib/utils";
import type { LocationWithStats } from "@/types";
import { useSession } from "next-auth/react";
import { toast, Toaster } from "sonner";
import { Plus, Search, Edit2, Trash2, MapPin, ArrowUpDown } from "lucide-react";

export default function LocationsPage() {
  const { data: session } = useSession();
  const canWrite = session?.user?.role_id === 2; // Inventory Controller only

  const [locations, setLocations] = useState<LocationWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [modalOpen, setModalOpen] = useState(false);
  const [editLoc, setEditLoc] = useState<LocationWithStats | null>(null);
  const [formData, setFormData] = useState({ name: "", type: "Shelf", capacity: "" as string | number });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteLocId, setDeleteLocId] = useState<number | null>(null);
  const [deleteLocName, setDeleteLocName] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [traceLocId, setTraceLocId] = useState<number | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      setLocations(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to fetch locations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return locations.filter(
      (l) => l.name.toLowerCase().includes(q) || l.type.toLowerCase().includes(q)
    );
  }, [locations, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField as keyof LocationWithStats];
      const bVal = b[sortField as keyof LocationWithStats];
      const cmp = typeof aVal === "string" && typeof bVal === "string"
        ? aVal.localeCompare(bVal)
        : Number(aVal) - Number(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const pageData = sorted.slice((page - 1) * pageSize, page * pageSize);

  const openAddModal = () => {
    setEditLoc(null);
    setFormData({ name: "", type: "Shelf", capacity: "" });
    setModalOpen(true);
  };

  const openEditModal = (loc: LocationWithStats) => {
    setEditLoc(loc);
    setFormData({ name: loc.name, type: loc.type, capacity: loc.capacity });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) { toast.error("Location name is required"); return; }
    setSaving(true);
    try {
      const url = editLoc ? `/api/locations/${editLoc.id}` : "/api/locations";
      const method = editLoc ? "PUT" : "POST";
      const payload = {
        ...formData,
        capacity: parseInt(String(formData.capacity)) || 1000,
      };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      toast.success(editLoc ? "Location updated" : "Location created");
      setModalOpen(false);
      fetchLocations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const handleDeleteClick = (e: React.MouseEvent, loc: LocationWithStats) => {
    e.stopPropagation();
    setDeleteLocId(loc.id);
    setDeleteLocName(loc.name);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteLocId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/locations/${deleteLocId}`, { method: "DELETE" });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to delete location"); }
      toast.success(`"${deleteLocName}" deleted`);
      setDeleteModalOpen(false);
      setDeleteLocId(null);
      fetchLocations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete location");
    } finally { setDeleting(false); }
  };

  const getUtilBar = (pct: number) => {
    const color = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#10b981";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s" }} />
        </div>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, color }}>{pct}%</span>
      </div>
    );
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <Toaster position="top-right" richColors />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>Locations</h1>
            <p>{locations.length} warehouse locations</p>
          </div>
          {canWrite && (
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} /> Add Location
            </button>
          )}
        </div>

        {loading ? (
          <LoadingSkeleton type="table" count={6} />
        ) : locations.length === 0 ? (
          <div className="table-container">
            <EmptyState
              icon={MapPin}
              title="No locations yet"
              message="Add warehouse bins, shelves, or zones to organize inventory."
              action={canWrite ? { label: "Add Location", onClick: openAddModal } : undefined}
            />
          </div>
        ) : (
          <div className="table-container">
            <div className="table-header">
              <h2>All Locations</h2>
              <div className="table-actions">
                <div style={{ position: "relative" }}>
                  <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input className="search-input" style={{ paddingLeft: 34 }} placeholder="Search locations..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort("name")}>Name <ArrowUpDown size={12} className={`sort-icon ${sortField === "name" ? "active" : ""}`} /></th>
                    <th onClick={() => handleSort("type")}>Type</th>
                    <th className="text-right" onClick={() => handleSort("capacity")}>Capacity</th>
                    <th className="text-right" onClick={() => handleSort("total_quantity")}>Stored Qty</th>
                    <th className="text-right" onClick={() => handleSort("lot_count")}>Lots</th>
                    <th style={{ minWidth: 150 }}>Utilization</th>
                    {canWrite && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((loc) => {
                    const isEmpty = loc.total_quantity === 0 && loc.lot_count === 0;
                    return (
                      <tr
                        key={loc.id}
                        className="clickable-row"
                        onClick={() => setTraceLocId(loc.id)}
                        title="Click to see stored items"
                      >
                        <td className="font-semibold">{loc.name}</td>
                        <td><span className="badge badge-default">{loc.type}</span></td>
                        <td className="text-right">{formatNumber(loc.capacity)}</td>
                        <td className="text-right font-semibold">{formatNumber(loc.total_quantity)}</td>
                        <td className="text-right">{loc.lot_count}</td>
                        <td>{getUtilBar(loc.utilization_percent)}</td>
                        {canWrite && (
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                className="btn btn-outline btn-sm btn-icon"
                                onClick={(e) => { e.stopPropagation(); openEditModal(loc); }}
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              {/* Delete only shown when location is empty */}
                              {isEmpty && (
                                <button
                                  className="btn btn-sm btn-icon"
                                  style={{ color: "#ef4444", border: "1px solid #fecaca", background: "#fff" }}
                                  onClick={(e) => handleDeleteClick(e, loc)}
                                  title="Delete (empty location)"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="table-pagination">
                <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}</span>
                <div className="pagination-buttons">
                  <button className="pagination-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                    <button key={i + 1} className={`pagination-btn ${page === i + 1 ? "active" : ""}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
                  ))}
                  <button className="pagination-btn" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Add/Edit Modal ── */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editLoc ? "Edit Location" : "Add New Location"}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editLoc ? "Update" : "Create"}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Location Name *</label>
            <input
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Shelf A-01"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select
                className="form-select"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="Shelf">Shelf</option>
                <option value="Bin">Bin</option>
                <option value="Zone">Zone</option>
                <option value="Rack">Rack</option>
                <option value="Cold Storage">Cold Storage</option>
                <option value="Dry Cabinet">Dry Cabinet</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Capacity</label>
              <input
                className="form-input"
                type="number"
                min="1"
                placeholder="e.g. 1000"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                onFocus={(e) => e.target.select()}
              />
            </div>
          </div>
        </Modal>

        {/* ── Delete Confirmation Modal ── */}
        <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Location">
          <div style={{ padding: "8px 4px" }}>
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Trash2 size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontWeight: 700, color: "#991b1b", margin: "0 0 4px" }}>This action cannot be undone</p>
                <p style={{ fontSize: "0.88rem", color: "#b91c1c", margin: 0 }}>
                  Are you sure you want to delete <strong>{deleteLocName}</strong>?
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteModalOpen(false)} className="btn btn-outline" disabled={deleting}>Cancel</button>
              <button onClick={handleConfirmDelete} className="btn btn-danger" disabled={deleting}>
                {deleting ? "Deleting..." : "Delete Location"}
              </button>
            </div>
          </div>
        </Modal>

        {/* Traceability Modal */}
        <TraceabilityModal
          mode="location-items"
          entityId={traceLocId}
          isOpen={traceLocId !== null}
          onClose={() => setTraceLocId(null)}
        />
      </main>
    </div>
  );
}