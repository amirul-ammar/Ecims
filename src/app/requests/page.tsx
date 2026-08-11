"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Loader,
  AlertCircle,
  ArrowLeft,
  Package,
  Clock,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import Sidebar from "@/components/Sidebar";

interface Request {
  id: number;
  user_id: number;
  part_id: number;
  quantity: number;
  status: "pending" | "approved" | "rejected" | "completed";
  notes: string | null;
  created_at: string;
  user: { id: number; name: string; email: string; role: { name: string } };
  part: { id: number; sku: string; name: string; unit: string; price: number };
}

interface Part {
  id: number;
  sku: string;
  name: string;
  unit: string;
}

interface Location {
  id: number;
  name: string;
}

interface Lot {
  id: number;
  lot_number: string;
  quantity: number;
  date_code: string | null;
  expiry_date: string | null;
  location_name: string | null;
  location_id: number | null;
}

const ROLE_ENGINEERING = 4;
const ROLE_INVENTORY_CONTROLLER = 2;
const ROLE_WAREHOUSE = 3;
const ROLE_ADMIN = 1;

/* ── Request Status Timeline Component ─────────────────── */
function RequestTimeline({ status }: { status: Request["status"] }) {
  const steps = [
    {
      key: "pending",
      label: "Submitted",
      icon: Clock,
    },
    {
      key: "approved",
      label: "Approved",
      icon: CheckCircle,
    },
    {
      key: "completed",
      label: "Fulfilled",
      icon: Truck,
    },
  ];

  // Map status to step index
  const getStepState = (stepKey: string): "done" | "active" | "pending" => {
    if (status === "rejected") {
      // Show only first step as done (red), rest inactive
      return stepKey === "pending" ? "active" : "pending";
    }
    const order = ["pending", "approved", "completed"];
    const currentIdx = order.indexOf(status);
    const stepIdx = order.indexOf(stepKey);
    if (stepIdx < currentIdx) return "done";
    if (stepIdx === currentIdx) return "active";
    return "pending";
  };

  if (status === "rejected") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: "#fee2e2",
          color: "#b91c1c",
          borderRadius: 999,
          padding: "3px 10px",
          fontSize: "0.75rem",
          fontWeight: 600,
        }}
      >
        <XCircle size={12} /> Rejected
      </span>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        minWidth: 180,
      }}
    >
      {steps.map((step, i) => {
        const state = getStepState(step.key);
        const Icon = step.icon;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
            {/* Step circle */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background:
                    state === "done"
                      ? "#10b981"
                      : state === "active"
                      ? "#10b981"
                      : "#e2e8f0",
                  color:
                    state === "pending" ? "#94a3b8" : "#fff",
                  transition: "background 0.3s",
                  flexShrink: 0,
                }}
              >
                <Icon size={13} />
              </div>
              <span
                style={{
                  fontSize: "0.6rem",
                  fontWeight: state === "active" ? 700 : 500,
                  color:
                    state === "done"
                      ? "#10b981"
                      : state === "active"
                      ? "#10b981"
                      : "#94a3b8",
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                style={{
                  width: 24,
                  height: 2,
                  background:
                    getStepState(steps[i + 1].key) !== "pending" ||
                    state === "done"
                      ? "#10b981"
                      : "#e2e8f0",
                  marginBottom: 14,
                  flexShrink: 0,
                  transition: "background 0.3s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────── */
export default function RequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [requests, setRequests] = useState<Request[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);

  // Create request modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    part_id: 0,
    quantity: "" as string | number,
    notes: "",
  });
  const [creating, setCreating] = useState(false);

  // Approve/Reject modal
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [actionFormData, setActionFormData] = useState({ notes: "", reason: "" });
  const [actionLoading, setActionLoading] = useState(false);

  // Complete request modal
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completeFormData, setCompleteFormData] = useState({ lot_id: 0, location_id: 0, location_name: "", override_reason: "" });
  // Track if selected lot is a FEFO override (not the first/earliest lot)
  const isCompleteOverride = completeFormData.lot_id > 0 && lots.length > 0 && lots[0].id !== completeFormData.lot_id;
  const [completeLoading, setCompleteLoading] = useState(false);

  // Detail view modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<Request | null>(null);

  const isEngineering = session?.user?.role_id === ROLE_ENGINEERING;
  const isInventoryController = session?.user?.role_id === ROLE_INVENTORY_CONTROLLER;
  const isWarehouse = session?.user?.role_id === ROLE_WAREHOUSE;
  const isAdmin = session?.user?.role_id === ROLE_ADMIN;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    Promise.all([fetchRequests(), fetchParts(), fetchLocations()]);
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/requests");
      if (!res.ok) throw new Error("Failed to fetch requests");
      const data = await res.json();
      setRequests(data);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Failed to load requests");
    }
  };

  const fetchParts = async () => {
    try {
      const res = await fetch("/api/parts");
      if (!res.ok) throw new Error("Failed to fetch parts");
      const data = await res.json();
      setParts(data || []);
      if (data.length > 0 && createFormData.part_id === 0) {
        setCreateFormData((prev) => ({ ...prev, part_id: data[0].id }));
      }
    } catch (error) {
      console.error("Error fetching parts:", error);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error("Failed to fetch locations");
      const data = await res.json();
      setLocations(data || []);
      if (data.length > 0 && completeFormData.location_id === 0) {
        setCompleteFormData((prev) => ({ ...prev, location_id: data[0].id }));
      }
    } catch (error) {
      console.error("Error fetching locations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLots = async (partId: number) => {
    try {
      // Use FEFO-sorted lots endpoint (earliest expiry first)
      const res = await fetch(`/api/lots?partId=${partId}`);
      if (!res.ok) throw new Error("Failed to fetch lots");
      const data = await res.json();
      setLots(data || []);
      // Auto-select the first lot (FEFO recommended) and its location
      if (data && data.length > 0) {
        setCompleteFormData((prev) => ({ ...prev, lot_id: data[0].id, location_id: data[0].location_id || 0 }));
      }
    } catch (error) {
      console.error("Error fetching lots:", error);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createFormData.part_id <= 0 || !createFormData.quantity || parseInt(String(createFormData.quantity)) <= 0) {
      toast.error("Please select a part and enter quantity");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...createFormData, quantity: parseInt(String(createFormData.quantity)) }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create request");
      }
      toast.success("Request created successfully");
      setIsCreateModalOpen(false);
      setCreateFormData({ part_id: 0, quantity: "", notes: "" });
      fetchRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create request");
    } finally {
      setCreating(false);
    }
  };

  const handleApproveReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !actionType) return;
    const endpoint =
      actionType === "approve"
        ? `/api/requests/${selectedRequest.id}/approve`
        : `/api/requests/${selectedRequest.id}/reject`;
    const payload =
      actionType === "approve"
        ? { notes: actionFormData.notes }
        : { reason: actionFormData.reason };
    setActionLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to process request");
      }
      toast.success(actionType === "approve" ? "Request approved" : "Request rejected");
      setIsActionModalOpen(false);
      setActionFormData({ notes: "", reason: "" });
      setSelectedRequest(null);
      fetchRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process request");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) { toast.error("No request selected"); return; }
    if (completeFormData.location_id <= 0) { toast.error("Please select a valid location"); return; }
    if (isCompleteOverride && !completeFormData.override_reason.trim()) { toast.error("A reason is required when overriding FEFO selection"); return; }
    setCompleteLoading(true);
    try {
      const res = await fetch(`/api/requests/${selectedRequest.id}/complete`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: completeFormData.location_id,
          lot_id: completeFormData.lot_id > 0 ? completeFormData.lot_id : undefined,
          is_fefo_override: isCompleteOverride ? 1 : 0,
          override_reason: isCompleteOverride ? completeFormData.override_reason : null,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        let errorMessage = "Failed to complete request";
        if (error?.error) {
          errorMessage = typeof error.error === "string"
            ? error.error
            : Array.isArray(error.error)
            ? error.error.map((e: any) => e.message || e).join(", ")
            : errorMessage;
        }
        throw new Error(errorMessage);
      }
      toast.success("Request completed");
      setIsCompleteModalOpen(false);
setCompleteFormData({ lot_id: 0, location_id: 0, location_name: "", override_reason: "" });      setSelectedRequest(null);
      fetchRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete request");
    } finally {
      setCompleteLoading(false);
    }
  };

  const openApproveModal = (request: Request) => {
    setSelectedRequest(request);
    setActionType("approve");
    setActionFormData({ notes: "", reason: "" });
    setIsActionModalOpen(true);
  };

  const openRejectModal = (request: Request) => {
    setSelectedRequest(request);
    setActionType("reject");
    setActionFormData({ notes: "", reason: "" });
    setIsActionModalOpen(true);
  };

  const openCompleteModal = (request: Request) => {
    setSelectedRequest(request);
    if (locations.length > 0) {
setCompleteFormData({ lot_id: 0, location_id: 0, location_name: "", override_reason: "" });    }
    fetchLots(request.part_id);
    setIsCompleteModalOpen(true);
  };

  if (status === "loading" || loading) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <LoadingSkeleton type="table" />
        </main>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <button
          onClick={() => router.push("/dashboard")}
          className="btn btn-secondary"
          style={{ marginBottom: "1rem" }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <div className="page-header">
          <div>
            <h1>Requests</h1>
            <p>Manage part requests and fulfillment</p>
          </div>
          {isEngineering && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn btn-primary"
            >
              <Plus size={16} /> Create Request
            </button>
          )}
        </div>

        {/* Requests Table */}
        <div className="table-container">
          {requests.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <AlertCircle size={40} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
              <p>No requests found</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>Qty</th>
                    <th>Progress</th>
                    {!isEngineering && <th>Requester</th>}
                    <th>Created</th>
                    <th style={{ textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{req.part.sku}</div>
                        <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{req.part.name}</div>
                      </td>
                      <td>{req.quantity} {req.part.unit}</td>
                      <td>
                        <RequestTimeline status={req.status} />
                      </td>
                      {!isEngineering && (
                        <td>
                          <div>{req.user.name}</div>
                          <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{req.user.role.name}</div>
                        </td>
                      )}
                      <td>{new Date(req.created_at).toLocaleDateString()}</td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          onClick={() => { setDetailRequest(req); setIsDetailModalOpen(true); }}
                          className="btn-icon btn-icon-secondary"
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                        {isInventoryController && req.status === "pending" && (
                          <>
                            <button onClick={() => openApproveModal(req)} className="btn-icon btn-icon-success" title="Approve">
                              <CheckCircle size={16} />
                            </button>
                            <button onClick={() => openRejectModal(req)} className="btn-icon btn-icon-danger" title="Reject">
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                        {isWarehouse && req.status === "approved" && (
                          <button onClick={() => openCompleteModal(req)} className="btn-icon btn-icon-success" title="Complete">
                            <CheckCircle size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Request Modal */}
        {isEngineering && (
          <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="New Part Request">
            <form onSubmit={handleCreateRequest} style={{ padding: "4px 0" }}>

              {/* Step indicator */}
              <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
                {[["1", "Select Part"], ["2", "Set Quantity"], ["3", "Add Notes"]].map(([num, label], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", flex: i < 2 ? "1" : "none" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        background: "#3b82f6", color: "#fff", fontSize: "0.78rem", fontWeight: 700,
                      }}>{num}</div>
                      <span style={{ fontSize: "0.68rem", color: "#64748b", whiteSpace: "nowrap" }}>{label}</span>
                    </div>
                    {i < 2 && <div style={{ flex: 1, height: 2, background: "#e2e8f0", margin: "0 6px", marginBottom: 14 }} />}
                  </div>
                ))}
              </div>

              {/* Part selector */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">
                  Part / Component <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  className="form-select"
                  value={createFormData.part_id}
                  onChange={(e) => setCreateFormData((prev) => ({ ...prev, part_id: parseInt(e.target.value) }))}
                  required
                  style={{ fontSize: "0.9rem" }}
                >
                  <option value={0}>— Select a part —</option>
                  {parts.map((part) => (
                    <option key={part.id} value={part.id}>
                      {part.sku} — {part.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected part preview card */}
              {createFormData.part_id > 0 && (() => {
                const selectedPart = parts.find((p) => p.id === createFormData.part_id);
                if (!selectedPart) return null;
                return (
                  <div style={{
                    background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10,
                    padding: "12px 14px", marginBottom: 14, display: "flex", gap: 12, alignItems: "center",
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, background: "#3b82f6",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <span style={{ color: "#fff", fontSize: "1rem" }}>📦</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>{(selectedPart as any).name}</div>
                      <div style={{ fontSize: "0.78rem", color: "#0369a1", fontFamily: "monospace" }}>{(selectedPart as any).sku}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "0.72rem", color: "#64748b" }}>Available</div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>{(selectedPart as any).total_stock ?? "—"} pcs</div>
                    </div>
                  </div>
                );
              })()}

              {/* Quantity */}
              {(() => {
                const sp = parts.find((p) => p.id === createFormData.part_id) as any;
                const avail = Number(sp?.total_stock ?? 0);
                const qty = parseInt(String(createFormData.quantity)) || 0;
                const isOver = qty > avail && avail > 0;
                return (
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label className="form-label">
                      Quantity <span style={{ color: "#ef4444" }}>*</span>
                      {sp && (
                        <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "#94a3b8", marginLeft: 6 }}>
                          max {avail} pcs available
                        </span>
                      )}
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        value={createFormData.quantity}
                        onChange={(e) => setCreateFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                        placeholder="Enter quantity needed"
                        required
                        onFocus={(e) => e.target.select()}
                        style={{ paddingRight: 50, borderColor: isOver ? "#ef4444" : undefined }}
                      />
                      <span style={{
                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                        fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", pointerEvents: "none",
                      }}>pcs</span>
                    </div>
                    {isOver && (
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5, color: "#ef4444", fontSize: "0.82rem" }}>
                        ⚠ Requested quantity exceeds available stock ({avail} pcs)
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Notes */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">
                  Notes
                  <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "#94a3b8", marginLeft: 6 }}>(optional)</span>
                </label>
                <textarea
                  className="form-textarea"
                  value={createFormData.notes}
                  onChange={(e) => setCreateFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g. Needed for PCB assembly line 3, urgent request..."
                  rows={3}
                  style={{ resize: "none" }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating || createFormData.part_id === 0 || !createFormData.quantity || (() => {
                  const sp = parts.find((p) => p.id === createFormData.part_id) as any;
                  const qty = parseInt(String(createFormData.quantity)) || 0;
                  return sp ? qty > Number(sp.total_stock ?? 0) || qty <= 0 : false;
                })()}>
                  {creating ? <Loader size={16} className="spinner" /> : null}
                  {creating ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Approve/Reject Modal */}
        {isInventoryController && (
          <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)}
            title={`${actionType === "approve" ? "Approve" : "Reject"} Request`}>
            <form onSubmit={handleApproveReject} className="modal-body">
              {selectedRequest && (
                <div style={{ marginBottom: "1.5rem", padding: "1rem", backgroundColor: "var(--color-bg-secondary)",
                  borderRadius: "8px", display: "flex", alignItems: "center", gap: "0.75rem", border: "1px solid var(--color-border)" }}>
                  <Package size={20} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
                  <div>
                    <p style={{ fontWeight: 600, margin: 0, marginBottom: "0.2rem" }}>
                      {selectedRequest.part.sku} ×{selectedRequest.quantity} {selectedRequest.part.unit}
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)", margin: 0 }}>
                      {selectedRequest.part.name} · Requested by {selectedRequest.user.name}
                    </p>
                  </div>
                </div>
              )}
              {actionType === "approve" ? (
                <div className="form-group">
                  <label htmlFor="notes">Approval Notes <span style={{ fontWeight: 400, fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>(optional)</span></label>
                  <textarea id="notes" value={actionFormData.notes}
                    onChange={(e) => setActionFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any notes for the warehouse team..." style={{ minHeight: "90px", width: "100%", resize: "vertical" }} />
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="reason">Rejection Reason <span style={{ color: "var(--color-danger)", fontWeight: 600 }}>*</span></label>
                  <textarea id="reason" value={actionFormData.reason}
                    onChange={(e) => setActionFormData((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="Explain why you are rejecting this request..." style={{ minHeight: "90px", width: "100%", resize: "vertical" }} required />
                </div>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => setIsActionModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className={actionType === "approve" ? "btn btn-success" : "btn btn-danger"} disabled={actionLoading}>
                  {actionLoading ? <Loader size={16} className="spinner" /> : null}
                  {actionType === "approve" ? "Approve" : "Reject"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Complete Request Modal — FEFO auto-recommended */}
        {isWarehouse && (
          <Modal isOpen={isCompleteModalOpen} onClose={() => setIsCompleteModalOpen(false)} title="Fulfill Request">
            <form onSubmit={handleCompleteRequest} style={{ padding: "4px 0" }}>
              {selectedRequest && (
                <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10, padding: "14px 16px", marginBottom: 18, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <p style={{ fontWeight: 700, color: "#0f172a", margin: "0 0 2px" }}>
                      {selectedRequest.part.sku} — {selectedRequest.part.name}
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "#0369a1", margin: 0 }}>
                      Quantity needed: <strong>{selectedRequest.quantity} {selectedRequest.part.unit}</strong> · Requested by {selectedRequest.user.name}
                    </p>
                  </div>
                </div>
              )}

              {/* FEFO Lot Selection */}
              {lots.length > 0 ? (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">
                    Select Lot
                    <span style={{ marginLeft: 8, fontSize: "0.75rem", fontWeight: 400, color: "#64748b" }}>
                      — sorted by earliest expiry (FEFO)
                    </span>
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {lots.map((lot, i) => {
                      const isFefo = i === 0;
                      const isSelected = completeFormData.lot_id === lot.id;
                      const expiryDate = lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString("en-GB") : "No expiry";
                      const daysLeft = lot.expiry_date
                        ? Math.ceil((new Date(lot.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        : null;
                      return (
                        <div
                          key={lot.id}
                          onClick={() => setCompleteFormData((prev) => ({ ...prev, lot_id: lot.id, location_id: lot.location_id || 0, override_reason: "" }))}
                          style={{
                            padding: "12px 14px",
                            borderRadius: 10,
                            border: isSelected && !isFefo ? "2px solid #ef4444" : isSelected ? "2px solid #10b981" : "1.5px solid #e2e8f0",
                            background: isSelected && !isFefo ? "#fef2f2" : isSelected ? "#f0fdf4" : "#fff",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            transition: "all 0.15s",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {/* Radio indicator */}
                            <div style={{
                              width: 18, height: 18, borderRadius: "50%",
                              border: isSelected && !isFefo ? "2px solid #ef4444" : isSelected ? "2px solid #10b981" : "2px solid #cbd5e1",
                              background: isSelected && !isFefo ? "#ef4444" : isSelected ? "#10b981" : "#fff",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              flexShrink: 0,
                            }}>
                              {isSelected && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f172a" }}>{lot.lot_number}</span>
                                {isFefo && (
                                  <span style={{ background: "#dcfce7", color: "#15803d", fontSize: "0.68rem", fontWeight: 700, borderRadius: 999, padding: "2px 7px" }}>
                                    ⭐ FEFO
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 1 }}>
                                Qty: {lot.quantity} pcs · Expires: {expiryDate}
                                {daysLeft !== null && (
                                  <span style={{ marginLeft: 6, color: daysLeft <= 30 ? "#ef4444" : daysLeft <= 90 ? "#f59e0b" : "#64748b", fontWeight: 600 }}>
                                    ({daysLeft}d left)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {lot.location_name && (
                            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{lot.location_name}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ padding: "16px", textAlign: "center", color: "#94a3b8", background: "#f8fafc", borderRadius: 10, marginBottom: 16 }}>
                  No available lots found for this part.
                </div>
              )}

              {/* FEFO Override Warning + Reason */}
              {isCompleteOverride && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: "#ef4444", fontSize: "0.88rem", marginBottom: 6 }}>
                    ⚠ FEFO Override Detected
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "#b91c1c", margin: "0 0 10px" }}>
                    You have selected a non-FEFO lot. This override will be recorded in the transaction log and reflected in the FEFO Compliance analytics.
                  </p>
                  <label className="form-label" style={{ color: "#991b1b" }}>
                    Override Reason <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <textarea
                    className="form-textarea"
                    value={completeFormData.override_reason}
                    onChange={(e) => setCompleteFormData((prev) => ({ ...prev, override_reason: e.target.value }))}
                    placeholder="e.g. FEFO lot has damaged packaging, using next available lot instead..."
                    rows={2}
                    style={{ resize: "none", borderColor: "#fca5a5" }}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" onClick={() => setIsCompleteModalOpen(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-success" disabled={completeLoading || lots.length === 0 || (isCompleteOverride && !completeFormData.override_reason.trim())}>
                  {completeLoading ? <Loader size={16} className="spinner" /> : null} Fulfill Request
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Detail View Modal */}
        <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Request Details">
          {detailRequest && (
            <div className="modal-body">
              {/* Timeline at top of detail modal */}
              <div style={{ marginBottom: "1.5rem", padding: "16px", background: "#f8fafc",
                borderRadius: 10, display: "flex", justifyContent: "center" }}>
                <RequestTimeline status={detailRequest.status} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>Part SKU</label>
                  <p style={{ marginTop: "0.25rem", fontWeight: 600 }}>{detailRequest.part.sku}</p>
                </div>
                <div>
                  <label style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>Part Name</label>
                  <p style={{ marginTop: "0.25rem" }}>{detailRequest.part.name}</p>
                </div>
                <div>
                  <label style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>Quantity</label>
                  <p style={{ marginTop: "0.25rem", fontWeight: 600 }}>{detailRequest.quantity} {detailRequest.part.unit}</p>
                </div>
                <div>
                  <label style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>Requested By</label>
                  <p style={{ marginTop: "0.25rem" }}>{detailRequest.user.name} ({detailRequest.user.role.name})</p>
                </div>
                <div>
                  <label style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>Created</label>
                  <p style={{ marginTop: "0.25rem" }}>{new Date(detailRequest.created_at).toLocaleString()}</p>
                </div>
              </div>

              {detailRequest.notes && (
                <div style={{ marginTop: "1rem" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>Notes</label>
                  <p style={{ marginTop: "0.25rem", whiteSpace: "pre-wrap" }}>{detailRequest.notes}</p>
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
                <button onClick={() => setIsDetailModalOpen(false)} className="btn btn-primary">Close</button>
              </div>
            </div>
          )}
        </Modal>
      </main>
    </div>
  );
}