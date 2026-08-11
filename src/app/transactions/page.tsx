"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TransactionTable from "@/components/TransactionTable";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import type { TransactionDetail } from "@/types";
import { toast, Toaster } from "sonner";
import Link from "next/link";
import { PackagePlus, PackageMinus } from "lucide-react";
import { useSession } from "next-auth/react";
import { ROLES } from "@/lib/rbac";

/**
 * Transaction history page with analytics and full history table.
 */
export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const canMutateStock = session?.user?.role_id ? ([ROLES.INVENTORY_CONTROLLER, ROLES.WAREHOUSE] as number[]).includes(session.user.role_id) : false;

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch("/api/transactions");
        const data = await res.json();
        setTransactions(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Failed to fetch transactions");
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <Toaster position="top-right" richColors />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1>Transactions</h1>
            <p>Full inventory transaction history</p>
          </div>
          <div className="table-actions">
            {canMutateStock && (
              <>
                <Link href="/transactions/receive" className="btn btn-success">
                  <PackagePlus size={18} /> Receive Stock
                </Link>
                <Link href="/transactions/issue" className="btn btn-danger">
                  <PackageMinus size={18} /> Issue Stock
                </Link>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton type="table" count={10} />
        ) : (
          <TransactionTable transactions={transactions} title="Transaction History" pageSize={15} />
        )}
      </main>
    </div>
  );
}
