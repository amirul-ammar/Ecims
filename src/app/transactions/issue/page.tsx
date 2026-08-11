"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import FefoLotSelector from "@/components/FefoLotSelector";
import { useSession } from "next-auth/react";
import { toast, Toaster } from "sonner";
import type { Part, Lot } from "@/types";
import { PackageMinus, ArrowLeft, ShieldOff, Package, AlertTriangle, Info } from "lucide-react";
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

export default function IssueStockPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const isRestricted = status === "authenticated" &&
    !([ROLES.INVENTORY_CONTROLLER, ROLES.WAREHOUSE] as number[]).includes(session?.user?.role_id ?? 0);

  const [parts, setParts] = useState<Part[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedPartId, setSelectedPartId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const isOverride = selectedLotId !== null && lots.length > 0 && lots[0].id !== selectedLotId;
  const totalAvailable = lots.reduce((sum, l) => sum + l.quantity, 0);
  const selectedLot = lots.find((l) => l.id === selectedLotId);
  const maxQuantity = selectedLot ? selectedLot.quantity : totalAvailable;
  const qtyNum = parseInt(quantity) || 0;
  const isOverQty = qtyNum > maxQuantity;

  const selectedPart = parts.find((p) => String(p.id) === selectedPartId) as any;

  useEffect(() => {
    const fetchParts = async () => {
      try {
        const res = await fetch("/api/parts");
        const data = await res.json();
        setParts(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Failed to load parts");
      } finally {
        setLoading(false);
      }
    };
    fetchParts();
  }, []);

  const fetchLots = useCallback(async (partId: string) => {
    if (!partId) { setLots([]); return; }
    setLotsLoading(true);
    try {
      const res = await fetch(`/api/lots?partId=${partId}`);
      const data = await res.json();
      setLots(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load lots");
    } finally {
      setLotsLoading(false);
    }
  }, []);

  const handlePartChange = (partId: string) => {
    setSelectedPartId(partId);
    setSelectedLotId(null);
    setReason("");
    setQuantity("");
    fetchLots(partId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartId || !quantity) { toast.error("Please select a part and enter a quantity"); return; }
    if (isOverride && !reason.trim()) { toast.error("A reason is required when overriding FEFO selection"); return; }
    if (isOverQty) { toast.error(`Insufficient stock. Available in lot: ${maxQuantity}`); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/transactions/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part_id: parseInt(selectedPartId),
          quantity: parseInt(quantity),
          lot_id: selectedLotId,
          reason: reason || null,
          notes: notes || null,
          user_id: session?.user?.id,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to issue stock"); }
      toast.success("Stock issued successfully!");
      router.push("/transactions");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to issue stock");
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
            <h1>Issue Stock</h1>
            <p>Deduct components using FEFO (First-Expired, First-Out)</p>
          </div>
        </div>

        {isRestricted ? (
          <div className="table-container" style={{ maxWidth: 680 }}>
            <div style={{ padding: 40, textAlign: "center" }}>
              <ShieldOff size={48} style={{ color: "var(--color-warning)", marginBottom: 16 }} />
              <h2 style={{ marginBottom: 8 }}>Access Restricted</h2>
              <p style={{ color: "var(--color-text-muted)" }}>Your role does not have permission to issue stock.</p>
              <Link href="/transactions" className="btn btn-outline" style={{ marginTop: 20 }}><ArrowLeft size={16} /> Back</Link>
            </div>
          </div>
        ) : loading ? (
          <div style={{ maxWidth: 680 }}>
            {[120, 200, 80].map((h, i) => (
              <div key={i} className="skeleton" style={{ height: h, borderRadius: 14, marginBottom: 16 }} />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ maxWidth: 680 }}>

            {/* Section 1 — Select Part */}
            <SectionCard icon={Package} title="Select Component" color="#3b82f6">
              <div className="form-group" style={{ marginBottom: selectedPart ? 12 : 0 }}>
                <label className="form-label">Part / Component <span style={{ color: "#ef4444" }}>*</span></label>
                <select className="form-select" value={selectedPartId} onChange={(e) => handlePartChange(e.target.value)} required>
                  <option value="">— Select a part —</option>
                  {parts.map((p) => <option key={p.id} value={p.id}>{(p as any).sku} — {p.name}</option>)}
                </select>
              </div>

              {/* Part preview + stock info */}
              {selectedPart && (
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: 2 }}>Selected</div>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1d4ed8", fontFamily: "monospace" }}>{selectedPart.sku}</div>
                    <div style={{ fontSize: "0.78rem", color: "#334155" }}>{selectedPart.name}</div>
                  </div>
                  <div style={{ background: totalAvailable === 0 ? "#fee2e2" : "#f0fdf4", border: `1px solid ${totalAvailable === 0 ? "#fecaca" : "#bbf7d0"}`, borderRadius: 10, padding: "10px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: 2 }}>Available</div>
                    <div style={{ fontWeight: 800, fontSize: "1.1rem", color: totalAvailable === 0 ? "#ef4444" : "#16a34a" }}>{totalAvailable}</div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>pcs</div>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Section 2 — Quantity */}
            {selectedPartId && (
              <SectionCard icon={AlertTriangle} title="Quantity to Issue" color="#f59e0b">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Quantity <span style={{ color: "#ef4444" }}>*</span>
                    <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "#94a3b8", marginLeft: 6 }}>
                      max {maxQuantity} pcs
                    </span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Enter quantity to issue"
                      style={{ paddingRight: 50, borderColor: isOverQty ? "#ef4444" : undefined }}
                      required
                      onFocus={(e) => e.target.select()}
                    />
                    <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: "0.82rem", fontWeight: 600, color: "#94a3b8", pointerEvents: "none" }}>pcs</span>
                  </div>
                  {isOverQty && (
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, color: "#ef4444", fontSize: "0.82rem" }}>
                      <AlertTriangle size={13} /> Insufficient stock — only {maxQuantity} pcs available in this lot
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Section 3 — FEFO Lot Selector */}
            {selectedPartId && (
              <SectionCard icon={Package} title="FEFO Lot Selection" color="#10b981">
                {lotsLoading ? (
                  <div className="skeleton" style={{ height: 120, borderRadius: 10 }} />
                ) : lots.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8" }}>
                    No available lots for this part.
                  </div>
                ) : (
                  <FefoLotSelector
                    lots={lots}
                    selectedLotId={selectedLotId}
                    onSelect={setSelectedLotId}
                    isOverride={isOverride}
                    reason={reason}
                    onReasonChange={setReason}
                  />
                )}
              </SectionCard>
            )}

            {/* Section 4 — Notes */}
            {selectedPartId && (
              <SectionCard icon={Info} title="Additional Notes" color="#64748b">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <textarea
                    className="form-textarea"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional — e.g. production order number, purpose of issuance..."
                    rows={3}
                    style={{ resize: "none" }}
                  />
                </div>
              </SectionCard>
            )}

            {/* Submit */}
            {selectedPartId && (
              <button
                type="submit"
                className="btn btn-danger"
                style={{ width: "100%", padding: "13px", fontSize: "1rem", borderRadius: 12 }}
                disabled={saving || isOverQty || !quantity || (isOverride && !reason.trim()) || lots.length === 0}
              >
                <PackageMinus size={20} /> {saving ? "Processing..." : "Confirm Stock Issue"}
              </button>
            )}
          </form>
        )}
      </main>
    </div>
  );
}