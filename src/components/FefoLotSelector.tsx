"use client";

import { formatDate } from "@/lib/utils";
import type { Lot } from "@/types";
import { AlertTriangle } from "lucide-react";

interface FefoLotSelectorProps {
  lots: Lot[];
  selectedLotId: number | null;
  onSelect: (lotId: number | null) => void;
  isOverride: boolean;
  reason: string;
  onReasonChange: (reason: string) => void;
}

/**
 * FEFO Lot Selector component.
 * Shows lots sorted by expiry (FEFO), highlights the recommended lot,
 * and warns when a non-FEFO lot is selected (override).
 */
export default function FefoLotSelector({
  lots,
  selectedLotId,
  onSelect,
  isOverride,
  reason,
  onReasonChange,
}: FefoLotSelectorProps) {
  if (lots.length === 0) {
    return (
      <div className="form-hint" style={{ padding: "20px", textAlign: "center" }}>
        No lots available for this part.
      </div>
    );
  }

  return (
    <div>
      <label className="form-label">Select Lot (FEFO Order)</label>

      {/* Auto-FEFO option */}
      <div className="fefo-selector">
        <div
          className={`fefo-lot ${selectedLotId === null ? "selected" : ""}`}
          onClick={() => onSelect(null)}
        >
          <div className="fefo-lot-radio" />
          <div className="fefo-lot-info">
            <div className="fefo-lot-number">Auto-FEFO (Recommended)</div>
            <div className="fefo-lot-details">
              System will automatically deduct from oldest-expiring lots first
            </div>
          </div>
        </div>

        {lots.map((lot, index) => {
          const isSelected = selectedLotId === lot.id;
          const isRecommended = index === 0;

          return (
            <div
              key={lot.id}
              className={`fefo-lot ${isSelected ? "selected" : ""} ${
                isRecommended ? "recommended" : ""
              }`}
              onClick={() => onSelect(lot.id)}
            >
              <div className="fefo-lot-radio" />
              <div className="fefo-lot-info">
                <div className="fefo-lot-number">Lot: {lot.lot_number}</div>
                <div className="fefo-lot-details">
                  <span>
                    Expires: {lot.expiry_date ? formatDate(lot.expiry_date) : "N/A"}
                  </span>
                  <span>Received: {formatDate(lot.received_date)}</span>
                  {lot.date_code && <span>DC: {lot.date_code}</span>}
                </div>
              </div>
              <div className="fefo-lot-qty">{lot.quantity} pcs</div>
            </div>
          );
        })}
      </div>

      {/* FEFO Override Warning */}
      {isOverride && (
        <div className="fefo-override-warning">
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>FEFO Override Warning:</strong> You selected a lot that is not
            the oldest-expiring. This will be flagged as a FEFO override.
            <div className="form-group" style={{ marginTop: 12, marginBottom: 0 }}>
              <label className="form-label">
                Override Reason (Required) *
              </label>
              <textarea
                className={`form-textarea ${!reason ? "error" : ""}`}
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="Please explain why this lot was selected instead of the FEFO-recommended lot..."
                rows={3}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
