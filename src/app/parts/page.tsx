"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import Modal from "@/components/Modal";
import TraceabilityModal from "@/components/TraceabilityModal";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { PartWithStock } from "@/types";
import { useSession } from "next-auth/react";
import { toast, Toaster } from "sonner";
import { Plus, Search, Edit2, Trash2, Package, ArrowUpDown, MapPin, Thermometer, Wind, Box, Layers, Star } from "lucide-react";

// ── Smart location suggestion logic ──────────────────────────────────────
function getLocationSuggestion(category: string): {
  recommended: string[];
  reason: string;
  icon: string;
} {
  const cat = category.toLowerCase();
  if (cat.includes("ic") || cat.includes("integrated") || cat.includes("crystal") || cat.includes("mosfet") || cat.includes("transistor")) {
    return { recommended: ["Dry Cabinet", "Cold Storage"], reason: "ICs, transistors and crystals are moisture-sensitive (MSL-rated). A Dry Cabinet or Cold Storage prevents oxidation and preserves shelf life.", icon: "🌡️" };
  }
  if (cat.includes("capacitor")) {
    return { recommended: ["Dry Cabinet", "Cold Storage"], reason: "Electrolytic capacitors degrade in humid environments. Dry Cabinet storage is strongly recommended to prevent ESR increase and leakage.", icon: "💧" };
  }
  if (cat.includes("led") || cat.includes("diode")) {
    return { recommended: ["Shelf", "Bin"], reason: "LEDs and diodes are generally stable at room temperature. A standard shelf or bin in a clean, dry area is suitable.", icon: "💡" };
  }
  if (cat.includes("resistor")) {
    return { recommended: ["Shelf", "Bin", "Rack"], reason: "Resistors are robust and non-moisture-sensitive. Any dry shelf, bin, or rack at room temperature is appropriate.", icon: "🔧" };
  }
  if (cat.includes("connector") || cat.includes("header")) {
    return { recommended: ["Bin", "Shelf"], reason: "Connectors are mechanically robust. A labelled bin or shelf at room temperature prevents mix-ups and physical damage.", icon: "🔌" };
  }
  if (cat.includes("pcb")) {
    return { recommended: ["Shelf", "Rack"], reason: "PCBs should be stored flat on shelves or racks, away from humidity and static. Anti-static bags recommended.", icon: "🖥️" };
  }
  return { recommended: ["Shelf", "Bin"], reason: "This component can be stored in a standard shelf or bin at room temperature in a clean, dry environment.", icon: "📦" };
}

function getLocationIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("cold")) return <Thermometer size={16} color="#3b82f6" />;
  if (t.includes("dry")) return <Wind size={16} color="#8b5cf6" />;
  if (t.includes("rack")) return <Layers size={16} color="#f59e0b" />;
  if (t.includes("bin")) return <Box size={16} color="#10b981" />;
  return <MapPin size={16} color="#64748b" />;
}

export default function PartsPage() {
  const { data: session } = useSession();
  const canWrite = session?.user?.role_id === 2;

  const [parts, setParts] = useState<PartWithStock[]>([]);
  const [locations, setLocations] = useState<{ id: number; name: string; type: string; capacity: number; utilization_percent: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<string>("sku");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [modalOpen, setModalOpen] = useState(false);
  const [editPart, setEditPart] = useState<PartWithStock | null>(null);
  const [formData, setFormData] = useState({
    sku: "", name: "", description: "", category: "General", unit: "pcs",
    price: "" as string | number,
    min_stock: "" as string | number,
    lead_days: "" as string | number,
  });
  const [saving, setSaving] = useState(false);

  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [newPartId, setNewPartId] = useState<number | null>(null);
  const [newPartName, setNewPartName] = useState("");
  const [newPartCategory, setNewPartCategory] = useState("");

  const [deletePartId, setDeletePartId] = useState<number | null>(null);
  const [deletePartName, setDeletePartName] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [tracePartId, setTracePartId] = useState<number | null>(null);

  const fetchParts = useCallback(async () => {
    try {
      const res = await fetch("/api/parts");
      const data = await res.json();
      setParts(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to fetch parts"); }
    finally { setLoading(false); }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      setLocations(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useEffect(() => { fetchParts(); fetchLocations(); }, [fetchParts, fetchLocations]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return parts.filter((p) =>
      p.sku.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [parts, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField as keyof PartWithStock];
      const bVal = b[sortField as keyof PartWithStock];
      const cmp = typeof aVal === "string" && typeof bVal === "string"
        ? aVal.localeCompare(bVal)
        : Number(aVal) - Number(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const pageData = sorted.slice((page - 1) * pageSize, page * pageSize);

  const openAddModal = () => {
    setEditPart(null);
    setFormData({ sku: "", name: "", description: "", category: "General", unit: "pcs", price: "", min_stock: "", lead_days: "" });
    setModalOpen(true);
  };

  const openEditModal = (part: PartWithStock) => {
    setEditPart(part);
    setFormData({ sku: part.sku, name: part.name, description: part.description ?? "", category: part.category, unit: part.unit, price: Number(part.price), min_stock: part.min_stock, lead_days: part.lead_days });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.sku || !formData.name) { toast.error("SKU and Name are required"); return; }
    setSaving(true);
    try {
      const url = editPart ? `/api/parts/${editPart.id}` : "/api/parts";
      const method = editPart ? "PUT" : "POST";
      const payload = { ...formData, price: parseFloat(String(formData.price)) || 0, min_stock: parseInt(String(formData.min_stock)) || 0, lead_days: parseInt(String(formData.lead_days)) || 30 };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to save part"); }
      const saved = await res.json();
      if (!editPart) {
        setNewPartId(saved.id);
        setNewPartName(saved.name || String(formData.name));
        setNewPartCategory(String(formData.category));
        setModalOpen(false);
        setLocationModalOpen(true);
      } else {
        toast.success("Part updated successfully");
        setModalOpen(false);
      }
      fetchParts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save part");
    } finally { setSaving(false); }
  };

  const handleGoToReceive = () => { window.location.href = `/transactions/receive?partId=${newPartId}`; };

  const handleSkipLocation = () => {
    toast.success(`"${newPartName}" created. Receive stock anytime from the Receive Stock page.`);
    setLocationModalOpen(false);
    setNewPartId(null); setNewPartName(""); setNewPartCategory("");
  };

  const handleDeleteClick = (e: React.MouseEvent, part: PartWithStock) => {
    e.stopPropagation();
    setDeletePartId(part.id); setDeletePartName(part.name); setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletePartId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/parts/${deletePartId}`, { method: "DELETE" });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to delete part"); }
      toast.success(`"${deletePartName}" deleted`);
      setDeleteModalOpen(false); setDeletePartId(null); fetchParts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete part");
    } finally { setDeleting(false); }
  };

  const suggestion = getLocationSuggestion(newPartCategory);

  return (
    <div className="app-layout">
      <Sidebar />
      <Toaster position="top-right" richColors />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>Parts</h1>
            <p>{parts.length} components in inventory</p>
          </div>
          {canWrite && (
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} /> Add Part
            </button>
          )}
        </div>

        {loading ? (
          <LoadingSkeleton type="table" count={8} />
        ) : parts.length === 0 ? (
          <div className="table-container">
            <EmptyState icon={Package} title="No parts yet" message="Add your first component to get started." action={canWrite ? { label: "Add Part", onClick: openAddModal } : undefined} />
          </div>
        ) : (
          <div className="table-container">
            <div className="table-header">
              <h2>All Parts</h2>
              <div className="table-actions">
                <div style={{ position: "relative" }}>
                  <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input className="search-input" style={{ paddingLeft: 34 }} placeholder="Search parts..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort("sku")}>SKU <ArrowUpDown size={12} className={`sort-icon ${sortField === "sku" ? "active" : ""}`} /></th>
                    <th onClick={() => handleSort("name")}>Name <ArrowUpDown size={12} className={`sort-icon ${sortField === "name" ? "active" : ""}`} /></th>
                    <th onClick={() => handleSort("category")}>Category</th>
                    <th onClick={() => handleSort("total_stock")} className="text-right">Stock <ArrowUpDown size={12} className={`sort-icon ${sortField === "total_stock" ? "active" : ""}`} /></th>
                    <th className="text-right">Min Stock</th>
                    <th className="text-right">Price</th>
                    <th>Status</th>
                    {canWrite && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((part) => (
                    <tr key={part.id} className="clickable-row" onClick={() => setTracePartId(part.id)} title="Click to see storage locations">
                      <td className="font-mono font-semibold">{part.sku}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{part.name}</div>
                        {part.description && <div style={{ fontSize: "0.75rem", color: "#94a3b8", maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{part.description}</div>}
                      </td>
                      <td><span className="badge badge-default">{part.category}</span></td>
                      <td className="text-right font-semibold" style={{ whiteSpace: "nowrap" }}>
                        <span style={{ color: Number(part.total_stock) === 0 ? "#ef4444" : undefined }}>
                          {formatNumber(Number(part.total_stock))} {part.unit}
                        </span>
                      </td>
                      <td className="text-right text-muted">{part.min_stock}</td>
                      <td className="text-right">{formatCurrency(Number(part.price))}</td>
                      <td>
                        {Number(part.total_stock) === 0
                          ? <span className="badge badge-danger">Out of Stock</span>
                          : part.is_low_stock
                          ? <span className="badge badge-warning">Low Stock</span>
                          : <span className="badge badge-success">Sufficient Stock</span>
                        }
                      </td>
                      {canWrite && (
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-outline btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); openEditModal(part); }} title="Edit"><Edit2 size={14} /></button>
                            {Number(part.total_stock) === 0 && (<button className="btn btn-sm btn-icon" style={{ color: "#ef4444", border: "1px solid #fecaca", background: "#fff" }} onClick={(e) => handleDeleteClick(e, part)} title="Delete (no stock)"><Trash2 size={14} /></button>)}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
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
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editPart ? "Edit Part" : "Add New Part"}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editPart ? "Update Part" : "Create Part"}</button>
            </>
          }
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">SKU *</label>
              <input
                className="form-input"
                value={formData.sku}
                onChange={(e) => {
                  const val = e.target.value
                    .toUpperCase()
                    .replace(/\s+/g, "-")
                    .replace(/[^A-Z0-9\-\/\.]/g, "")
                    .replace(/-{2,}/g, "-");
                  setFormData({ ...formData, sku: val });
                }}
                placeholder="Type naturally — spaces become dashes"
                style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Capacitor 100µF 16V" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Optional description..." rows={2} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Category</label>
              <input className="form-input" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="e.g. ICs, Resistors, Capacitors" />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <div style={{ position: "relative" }}>
                <input
                  className="form-input"
                  value="pcs"
                  readOnly
                  style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed", fontWeight: 600 }}
                />
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: "0.75rem", color: "#94a3b8" }}>🔒</span>
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Price (MYR)</label>
              <input className="form-input" type="number" step="0.01" min="0" placeholder="0.00" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} onFocus={(e) => e.target.select()} />
            </div>
            <div className="form-group">
              <label className="form-label">Min Stock Level</label>
              <input className="form-input" type="number" min="0" placeholder="0" value={formData.min_stock} onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })} onFocus={(e) => e.target.select()} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Lead Days</label>
            <input className="form-input" type="number" min="0" placeholder="30" value={formData.lead_days} onChange={(e) => setFormData({ ...formData, lead_days: e.target.value })} onFocus={(e) => e.target.select()} />
          </div>
        </Modal>

        {/* ── Smart Location Suggestion Modal ── */}
        <Modal isOpen={locationModalOpen} onClose={handleSkipLocation} title={`"${newPartName}" Added! 🎉`}>
          <div style={{ padding: "8px 4px" }}>

            {/* Suggestion banner */}
            <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: "1.2rem" }}>{suggestion.icon}</span>
                <span style={{ fontWeight: 700, color: "#0369a1", fontSize: "0.9rem" }}>
                  Recommended Storage for {newPartCategory}
                </span>
              </div>
              <p style={{ fontSize: "0.85rem", color: "#0c4a6e", margin: 0 }}>{suggestion.reason}</p>
            </div>

            {/* Location list */}
            <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Available Locations
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto", marginBottom: 18 }}>
              {locations.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: "0.85rem", textAlign: "center", padding: "16px 0" }}>No locations found.</p>
              ) : (
                locations.map((loc) => {
                  const isRecommended = suggestion.recommended.some(
                    (r) => loc.type.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(loc.type.toLowerCase())
                  );
                  return (
                    <div key={loc.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", borderRadius: 10,
                      border: isRecommended ? "1.5px solid #3b82f6" : "1px solid #e2e8f0",
                      background: isRecommended ? "#eff6ff" : "#fff",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {getLocationIcon(loc.type)}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#0f172a" }}>{loc.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{loc.type}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isRecommended && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#dbeafe", color: "#1d4ed8", borderRadius: 999, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700 }}>
                            <Star size={10} fill="#1d4ed8" /> Recommended
                          </span>
                        )}
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{loc.utilization_percent ?? 0}% full</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginBottom: 16 }}>
              Click <strong>Receive Stock Now</strong> to go to the Receive Stock page where you can select your preferred location.
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={handleSkipLocation} className="btn btn-outline">Skip — Do it later</button>
              <button onClick={handleGoToReceive} className="btn btn-primary"><Package size={16} /> Receive Stock Now</button>
            </div>
          </div>
        </Modal>

        {/* ── Delete Confirmation Modal ── */}
        <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Part">
          <div style={{ padding: "8px 4px" }}>
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Trash2 size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ fontWeight: 700, color: "#991b1b", margin: "0 0 4px" }}>This action cannot be undone</p>
                <p style={{ fontSize: "0.88rem", color: "#b91c1c", margin: 0 }}>
                  Are you sure you want to delete <strong>{deletePartName}</strong>? All associated lots and transactions will also be removed.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteModalOpen(false)} className="btn btn-outline" disabled={deleting}>Cancel</button>
              <button onClick={handleConfirmDelete} className="btn btn-danger" disabled={deleting}>{deleting ? "Deleting..." : "Delete Part"}</button>
            </div>
          </div>
        </Modal>

        {/* Traceability Modal */}
        <TraceabilityModal mode="part-locations" entityId={tracePartId} isOpen={tracePartId !== null} onClose={() => setTracePartId(null)} />
      </main>
    </div>
  );
}