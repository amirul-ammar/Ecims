"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Edit,
  Delete,
  Plus,
  Loader,
  AlertCircle,
  ArrowLeft,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import Sidebar from "@/components/Sidebar";

interface User {
  id: number;
  name: string;
  email: string;
  role_id: number;
  is_active: number;
  role: { id: number; name: string };
}

interface Role {
  id: number;
  name: string;
}

const ROLE_COLORS: Record<number, string> = {
  1: "badge-danger",
  2: "badge-info",
  3: "badge-warning",
  4: "badge-success",
};

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role_id: 2 });
  const [deleting, setDeleting] = useState<number | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmingUserId, setConfirmingUserId] = useState<number | null>(null);
  const [confirmingUserName, setConfirmingUserName] = useState<string>("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user?.role_id !== 1) router.push("/dashboard");
  }, [status, session, router]);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      setUsers(await res.json());
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    setRoles([
      { id: 1, name: "Admin" },
      { id: 2, name: "Inventory Controller" },
      { id: 3, name: "Warehouse" },
      { id: 4, name: "Engineering" },
    ]);
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setIsEditing(true);
      setEditingId(user.id);
      setFormData({ name: user.name, email: user.email, password: "", role_id: user.role_id });
    } else {
      setIsEditing(false);
      setEditingId(null);
      setFormData({ name: "", email: "", password: "", role_id: 2 });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setEditingId(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: name === "role_id" ? parseInt(value, 10) : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) { toast.error("Please fill in all required fields"); return; }
    if (!isEditing && !formData.password) { toast.error("Password is required for new users"); return; }

    try {
      const payload: any = { name: formData.name, email: formData.email, role_id: formData.role_id };
      if (!isEditing) payload.password = formData.password;
      else if (formData.password) payload.password = formData.password;

      const res = await fetch(isEditing ? `/api/users/${editingId}` : "/api/users", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) { const error = await res.json(); throw new Error(error.error || "Failed to save user"); }
      toast.success(isEditing ? "User updated successfully" : "User created successfully");
      handleCloseModal();
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save user");
    }
  };

  const handleDeleteConfirm = (id: number, userName: string) => {
    setConfirmingUserId(id);
    setConfirmingUserName(userName);
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!confirmingUserId) return;
    setDeleting(confirmingUserId);
    try {
      const res = await fetch(`/api/users/${confirmingUserId}`, { method: "DELETE" });
      if (!res.ok) { const err = await res.json(); throw new Error(err?.error || "Failed to delete user"); }
      toast.success("User deleted successfully");
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setDeleting(null);
      setIsConfirmOpen(false);
      setConfirmingUserId(null);
      setConfirmingUserName("");
    }
  };

  const handleCancelDelete = () => {
    setIsConfirmOpen(false);
    setConfirmingUserId(null);
    setConfirmingUserName("");
  };

  if (status === "loading" || loading) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content"><LoadingSkeleton type="table" /></main>
      </div>
    );
  }

  if (status === "unauthenticated" || session?.user?.role_id !== 1) return null;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <button onClick={() => router.push("/dashboard")} className="btn btn-outline btn-sm" style={{ marginBottom: "1rem" }}>
          <ArrowLeft size={16} /> Back
        </button>

        <div className="page-header">
          <div>
            <h1>User Management</h1>
            <p>{users.length} system users</p>
          </div>
          <button onClick={() => handleOpenModal()} className="btn btn-primary">
            <Plus size={16} /> Add New User
          </button>
        </div>

        {/* Users Table */}
        <div className="table-container">
          {users.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <AlertCircle size={40} style={{ margin: "0 auto 1rem", opacity: 0.5 }} />
              <p>No users found</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: "var(--color-primary)", color: "#fff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.8rem", fontWeight: 700, flexShrink: 0,
                        }}>
                          {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <span style={{ fontWeight: 600 }}>{user.name}</span>
                      </div>
                    </td>
                    <td style={{ color: "var(--color-text-muted)" }}>{user.email}</td>
                    <td>
                      <span className={`badge ${ROLE_COLORS[user.role_id] ?? "badge-default"}`}>
                        {user.role.name}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button onClick={() => handleOpenModal(user)} className="btn-icon btn-icon-primary" title="Edit user">
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteConfirm(user.id, user.name)}
                        className="btn-icon btn-icon-danger"
                        disabled={deleting === user.id}
                        title="Delete user"
                      >
                        {deleting === user.id ? <Loader size={16} className="spinner" /> : <Delete size={16} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Delete Confirmation Modal ── */}
        <Modal isOpen={isConfirmOpen} onClose={handleCancelDelete} title="Delete User">
          <div style={{ padding: "8px 4px" }}>
            <div style={{
              background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10,
              padding: "16px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start"
            }}>
              <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontWeight: 600, color: "#991b1b", margin: "0 0 4px" }}>This action cannot be undone</p>
                <p style={{ fontSize: "0.88rem", color: "#b91c1c", margin: 0 }}>
                  Are you sure you want to delete <strong>{confirmingUserName}</strong>?
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={handleCancelDelete} className="btn btn-outline" disabled={deleting !== null}>Cancel</button>
              <button onClick={handleConfirmDelete} className="btn btn-danger" disabled={deleting !== null}>
                {deleting ? <Loader size={16} className="spinner" /> : null} Delete User
              </button>
            </div>
          </div>
        </Modal>

        {/* ── Add / Edit User Modal ── */}
        <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={isEditing ? "Edit User" : "Add New User"}>
          <form onSubmit={handleSubmit} style={{ padding: "8px 4px" }}>

            {/* Info banner */}
            <div style={{
              background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 10,
              padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10
            }}>
              <Shield size={18} color="#0284c7" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: "0.85rem", color: "#0369a1" }}>
                {isEditing
                  ? "Editing existing user — email cannot be changed"
                  : "New user will receive access based on their assigned role"}
              </span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  className="form-input"
                  id="name" type="text" name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Ahmad Razak"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select
                  className="form-select"
                  id="role_id" name="role_id"
                  value={formData.role_id}
                  onChange={handleInputChange}
                  required
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                className="form-input"
                id="email" type="email" name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="e.g. ahmad@whizz.com"
                required
                disabled={isEditing}
              />
              {isEditing && (
                <div className="form-hint">Email address cannot be changed after account creation</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                Password
                {!isEditing && " *"}
                {isEditing && (
                  <span style={{ fontWeight: 400, fontSize: "0.8rem", color: "var(--color-text-muted)", marginLeft: 6 }}>
                    (leave blank to keep current)
                  </span>
                )}
              </label>
              <input
                className="form-input"
                id="password" type="password" name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder={isEditing ? "Leave blank to keep current password" : "Min. 6 characters"}
                required={!isEditing}
                minLength={6}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" onClick={handleCloseModal} className="btn btn-outline">Cancel</button>
              <button type="submit" className="btn btn-primary">
                {isEditing ? "Update User" : "Create User"}
              </button>
            </div>
          </form>
        </Modal>
      </main>
    </div>
  );
}