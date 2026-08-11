"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useSession } from "next-auth/react";
import { toast, Toaster } from "sonner";
import type { Part, Location } from "@/types";
import { PackagePlus, ArrowLeft, ShieldOff, Package, Hash, Calendar, Info, Star } from "lucide-react";

// Returns the ONLY allowed location types for this category
// Locations not in this list will be hidden from the selector
function getAllowedTypes(category: string): { allowed: string[]; recommended: string[]; reason: string } {
  const cat = category?.toLowerCase() || "";

  if (cat.includes("ic") || cat.includes("integrated") || cat.includes("crystal") || cat.includes("mosfet") || cat.includes("transistor") || cat.includes("optocoupler")) {
    return {
      allowed: ["Dry Cabinet", "Cold Storage"],
      recommended: ["Dry Cabinet", "Cold Storage"],
      reason: "ICs, transistors & crystals are moisture-sensitive and must be stored in a Dry Cabinet or Cold Storage.",
    };
  }
  if (cat.includes("capacitor")) {
    return {
      allowed: ["Dry Cabinet", "Cold Storage", "Shelf", "Bin", "Rack"],
      recommended: ["Dry Cabinet", "Cold Storage"],
      reason: "Electrolytic capacitors degrade in humidity — Dry Cabinet or Cold Storage recommended.",
    };
  }
  if (cat.includes("sensor") || cat.includes("transducer")) {
    return {
      allowed: ["Shelf", "Bin", "Rack", "Zone"],
      recommended: ["Shelf", "Bin"],
      reason: "Sensors should be stored at room temperature — not in Cold Storage as extreme cold may affect calibration.",
    };
  }
  if (cat.includes("led") || cat.includes("diode")) {
    return {
      allowed: ["Shelf", "Bin", "Rack", "Zone"],
      recommended: ["Shelf", "Bin"],
      reason: "LEDs and diodes are stable at room temperature. Standard shelf or bin storage is suitable.",
    };
  }
  if (cat.includes("resistor") || cat.includes("fuse") || cat.includes("inductor") || cat.includes("switch") || cat.includes("buzzer")) {
    return {
      allowed: ["Shelf", "Bin", "Rack", "Zone"],
      recommended: ["Shelf", "Bin"],
      reason: "Passive components are robust and suitable for any standard dry storage location.",
    };
  }
  if (cat.includes("connector") || cat.includes("header")) {
    return {
      allowed: ["Bin", "Shelf", "Rack", "Zone"],
      recommended: ["Bin", "Shelf"],
      reason: "Connectors are mechanically robust. A labelled bin or shelf prevents mix-ups.",
    };
  }
  if (cat.includes("pcb")) {
    return {
      allowed: ["Shelf", "Rack", "Zone"],
      recommended: ["Shelf", "Rack"],
      reason: "PCBs should be stored flat on shelves or racks, away from humidity and static.",
    };
  }
  if (cat.includes("relay")) {
    return {
      allowed: ["Shelf", "Rack", "Bin", "Zone"],
      recommended: ["Shelf", "Rack"],
      reason: "Relays can be stored at room temperature on any standard shelf or rack.",
    };
  }
  // Default — allow all except Cold Storage
  return {
    allowed: ["Shelf", "Bin", "Rack", "Zone", "Dry Cabinet"],
    recommended: ["Shelf", "Bin"],
    reason: "Standard components can be stored in any dry room-temperature location.",
  };
}

function isLocAllowed(locType: string, allowed: string[]): boolean {
  return allowed.some((a) =>
    locType.toLowerCase().includes(a.toLowerCase()) ||
    a.toLowerCase().includes(locType.toLowerCase())
  );
}

function isLocRecommended(locType: string, recommended: string[]): boolean {
  return recommended.some((r) =>
    locType.toLowerCase().includes(r.toLowerCase()) ||
    r.toLowerCase().includes(locType.toLowerCase())
  );
}
import Link from "next/link";
import { ROLES } from "@/lib/rbac";

function SectionCard({ icon: Icon, title, color, children }: {
  icon: any; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "11px 18px", display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={15} color={color} />
        </div>
        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a" }}>{title}</span>
      </div>
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </div>
  );
}

export default function ReceiveStockPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const isRestricted = status === "authenticated" &&
    !([ROLES.INVENTORY_CONTROLLER, ROLES.WAREHOUSE] as number[]).includes(session?.user?.role_id ?? 0);

  const [parts, setParts] = useState<Part[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    part_id: "",
    location_id: "",
    lot_number: "",
    date_code: "",
    received_date: new Date().toISOString().split("T")[0],
    expiry_date: "",
    quantity: "",
    notes: "",
  });

  const selectedPart = parts.find((p) => String(p.id) === formData.part_id) as any;
  const selectedUnit = selectedPart?.unit || "pcs";
  const selectedLocation = locations.find((l) => String(l.id) === formData.location_id) as any;
  const remainingCapacity = selectedLocation
    ? selectedLocation.capacity - (selectedLocation.total_quantity ?? 0)
    : null;
  const qtyNum = parseInt(formData.quantity) || 0;
  const isOverCapacity = remainingCapacity !== null && qtyNum > remainingCapacity;
  const isLocationFull = selectedLocation && remainingCapacity !== null && remainingCapacity <= 0;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [partsRes, locsRes] = await Promise.all([fetch("/api/parts"), fetch("/api/locations")]);
        const partsData = await partsRes.json();
        const locsData = await locsRes.json();
        setParts(Array.isArray(partsData) ? partsData : []);
        setLocations(Array.isArray(locsData) ? locsData : []);
        const partIdParam = searchParams.get("partId");
        if (partIdParam) setFormData((prev) => ({ ...prev, part_id: partIdParam }));
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.part_id || !formData.location_id || !formData.lot_number || !formData.quantity) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/transactions/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part_id: parseInt(formData.part_id),
          location_id: parseInt(formData.location_id),
          lot_number: formData.lot_number,
          date_code: formData.date_code || null,
          received_date: formData.received_date,
          expiry_date: formData.expiry_date || null,
          quantity: parseInt(formData.quantity),
          user_id: session?.user?.id,
          notes: formData.notes || null,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to receive stock"); }
      toast.success("Stock received successfully!");
      router.push("/transactions");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to receive stock");
    } finally {
      setSaving(false);
    }
  };



  return (
    <div className="app-layout">
      <Sidebar />
      <Toaster position="top-right" richColors />
      <main className="main-content">
        <div className="page-header">
          <div>
            <Link href="/transactions" className="btn btn-outline btn-sm" style={{ marginBottom: 8 }}>
              <ArrowLeft size={16} /> Back to Transactions
            </Link>
            <h1>Receive Stock</h1>
            <p>Record incoming components into warehouse inventory</p>
          </div>
        </div>

        {isRestricted ? (
          <div className="table-container" style={{ maxWidth: 680 }}>
            <div style={{ padding: 40, textAlign: "center" }}>
              <ShieldOff size={48} style={{ color: "var(--color-warning)", marginBottom: 16 }} />
              <h2 style={{ marginBottom: 8 }}>Access Restricted</h2>
              <p style={{ color: "var(--color-text-muted)" }}>Your role does not have permission to receive stock.</p>
              <Link href="/transactions" className="btn btn-outline" style={{ marginTop: 20 }}><ArrowLeft size={16} /> Back</Link>
            </div>
          </div>
        ) : loading ? (
          <div style={{ maxWidth: 680 }}>
            {[120, 160, 180, 80].map((h, i) => (
              <div key={i} className="skeleton" style={{ height: h, borderRadius: 14, marginBottom: 16 }} />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ maxWidth: 680 }}>

            {/* Section 1 — Component & Location */}
            <SectionCard icon={Package} title="Component & Location" color="#3b82f6">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Part / Component <span style={{ color: "#ef4444" }}>*</span></label>
                  <select className="form-select" value={formData.part_id} onChange={(e) => setFormData({ ...formData, part_id: e.target.value })} required>
                    <option value="">— Select a part —</option>
                    {parts.map((p) => <option key={p.id} value={p.id}>{(p as any).sku} — {p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Storage Location <span style={{ color: "#ef4444" }}>*</span>
                    {selectedPart && (
                      <span style={{ marginLeft: 8, fontSize: "0.72rem", fontWeight: 400, color: "#0369a1", background: "#e0f2fe", borderRadius: 999, padding: "2px 8px" }}>
                        Showing suitable locations for {selectedPart.category}
                      </span>
                    )}
                  </label>
                  {/* Custom location list with recommendations */}
                  {/* Filter and sort locations — allowed first, then by recommendation */}
                  {(() => {
                    const locInfo = selectedPart ? getAllowedTypes(selectedPart.category) : null;
                    const filteredLocs = locInfo
                      ? (locations as any[]).filter((l) => isLocAllowed(l.type, locInfo.allowed))
                      : (locations as any[]);
                    const hiddenCount = (locations as any[]).length - filteredLocs.length;
                    return (
                      <>
                        {locInfo && hiddenCount > 0 && (
                          <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 10, padding: "8px 12px", marginBottom: 6, fontSize: "0.78rem", color: "#92400e" }}>
                            ⚠ {hiddenCount} location{hiddenCount > 1 ? "s" : ""} hidden — unsuitable for <strong>{selectedPart.category}</strong>. {locInfo.reason}
                          </div>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto", padding: "2px 0" }}>
                    {filteredLocs.map((l) => {
                      const loc = l as any;
                      const isFull = loc.total_quantity >= loc.capacity;
                      const remaining = loc.capacity - (loc.total_quantity ?? 0);
                      const pct = Math.round((loc.total_quantity ?? 0) / loc.capacity * 100);
                      const recommended = locInfo ? isLocRecommended(loc.type, locInfo.recommended) : false;
                      const isSelected = String(loc.id) === formData.location_id;
                      return (
                        <div
                          key={loc.id}
                          onClick={() => !isFull && setFormData({ ...formData, location_id: String(loc.id) })}
                          style={{
                            padding: "9px 12px",
                            borderRadius: 10,
                            border: isSelected ? "2px solid #10b981" : recommended ? "1.5px solid #3b82f6" : "1px solid #e2e8f0",
                            background: isFull ? "#f8fafc" : isSelected ? "#f0fdf4" : recommended ? "#eff6ff" : "#fff",
                            cursor: isFull ? "not-allowed" : "pointer",
                            opacity: isFull ? 0.6 : 1,
                            transition: "all 0.15s",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {/* Radio */}
                              <div style={{ width: 16, height: 16, borderRadius: "50%", border: isSelected ? "2px solid #10b981" : "2px solid #cbd5e1", background: isSelected ? "#10b981" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {isSelected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                              </div>
                              <span style={{ fontWeight: 700, fontSize: "0.85rem", color: isFull ? "#94a3b8" : "#0f172a" }}>{loc.name}</span>
                              <span style={{ fontSize: "0.72rem", color: "#64748b", background: "#f1f5f9", borderRadius: 4, padding: "1px 6px" }}>{loc.type}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {recommended && !isFull && (
                                <span style={{ display: "flex", alignItems: "center", gap: 2, background: "#dbeafe", color: "#1d4ed8", fontSize: "0.68rem", fontWeight: 700, borderRadius: 999, padding: "2px 7px" }}>
                                  <Star size={9} fill="#1d4ed8" /> Recommended
                                </span>
                              )}
                              {isFull && <span style={{ fontSize: "0.72rem", color: "#ef4444", fontWeight: 600 }}>FULL</span>}
                            </div>
                          </div>
                          {/* Capacity bar */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#10b981", borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: "0.7rem", color: "#64748b", whiteSpace: "nowrap" }}>
                              {isFull ? "Full" : `${remaining} free`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                        </div>
                      </>
                    );
                  })()}
                  {/* Hidden select for form validation */}
                  <select
                    value={formData.location_id}
                    onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                    required
                    style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
                    tabIndex={-1}
                  >
                    <option value="">—</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Preview cards */}
              {(selectedPart || selectedLocation) && (
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  {selectedPart && (
                    <div style={{ flex: 1, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: 2 }}>Selected Part</div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1d4ed8", fontFamily: "monospace" }}>{selectedPart.sku}</div>
                      <div style={{ fontSize: "0.78rem", color: "#334155" }}>{selectedPart.name}</div>
                    </div>
                  )}
                  {selectedLocation && (
                    <div style={{
                      flex: 1, borderRadius: 10, padding: "10px 12px",
                      background: isLocationFull ? "#fee2e2" : "#f0fdf4",
                      border: `1px solid ${isLocationFull ? "#fecaca" : "#bbf7d0"}`,
                    }}>
                      <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: 2 }}>Selected Location</div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: isLocationFull ? "#ef4444" : "#16a34a" }}>{selectedLocation.name}</div>
                      <div style={{ fontSize: "0.78rem", color: "#334155" }}>{selectedLocation.type}</div>
                      <div style={{ fontSize: "0.75rem", marginTop: 4, fontWeight: 600, color: isLocationFull ? "#ef4444" : "#16a34a" }}>
                        {isLocationFull
                          ? "⚠ Location is full"
                          : `${remainingCapacity} pcs space remaining`}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>

            {/* Section 2 — Lot Details */}
            <SectionCard icon={Hash} title="Lot Details" color="#8b5cf6">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Lot Number <span style={{ color: "#ef4444" }}>*</span></label>
                  <input className="form-input" value={formData.lot_number} onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })} placeholder="e.g. LOT-2024-001" required />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Date Code
                    <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "#94a3b8", marginLeft: 6 }}>(optional)</span>
                  </label>
                  <input className="form-input" value={formData.date_code} onChange={(e) => setFormData({ ...formData, date_code: e.target.value })} placeholder="e.g. 2424" />
                </div>
              </div>
            </SectionCard>

            {/* Section 3 — Dates & Quantity */}
            <SectionCard icon={Calendar} title="Dates & Quantity" color="#f59e0b">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Received Date <span style={{ color: "#ef4444" }}>*</span></label>
                  <input className="form-input" type="date" value={formData.received_date} onChange={(e) => setFormData({ ...formData, received_date: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Expiry Date
                    <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "#94a3b8", marginLeft: 6 }}>(optional)</span>
                  </label>
                  <input className="form-input" type="date" value={formData.expiry_date} onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })} />
                  <div className="form-hint">Leave blank if no expiry date</div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Quantity <span style={{ color: "#ef4444" }}>*</span>
                  {selectedPart && <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "#94a3b8", marginLeft: 6 }}>(in {selectedUnit})</span>}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="Enter quantity received"
                    required
                    onFocus={(e) => e.target.select()}
                    style={{ paddingRight: 56, borderColor: isOverCapacity ? "#ef4444" : undefined }}
                  />
                  <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: "0.82rem", fontWeight: 600, color: "#94a3b8", pointerEvents: "none" }}>
                    {selectedUnit}
                  </span>
                </div>
                {isOverCapacity && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, color: "#ef4444", fontSize: "0.82rem" }}>
                    ⚠ Exceeds available space — only {remainingCapacity} pcs remaining in this location
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Section 4 — Notes */}
            <SectionCard icon={Info} title="Additional Notes" color="#64748b">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <textarea
                  className="form-textarea"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional — e.g. supplier name, delivery order number, remarks..."
                  rows={3}
                  style={{ resize: "none" }}
                />
              </div>
            </SectionCard>

            {/* Submit */}
            <button type="submit" className="btn btn-success" style={{ width: "100%", padding: "13px", fontSize: "1rem", borderRadius: 12 }} disabled={saving || isLocationFull || isOverCapacity || !formData.part_id || !formData.location_id || !formData.lot_number || !formData.quantity}>
              <PackagePlus size={20} /> {saving ? "Processing..." : "Confirm Stock Receipt"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}