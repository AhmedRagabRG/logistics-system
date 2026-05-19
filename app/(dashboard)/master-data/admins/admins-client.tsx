"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

interface AdminAccount {
  id: number;
  username: string;
  display_name: string | null;
  is_active: boolean;
  active_sessions: number;
  created_at: string;
  updated_at: string;
}

interface AdminsResponse {
  success: boolean;
  data?: {
    admins: AdminAccount[];
    current_admin_id: number;
  };
  error?: {
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

const emptyCreateForm = {
  username: '',
  display_name: '',
  password: '',
  confirm_password: '',
  is_active: true,
};

const emptyPasswordForm = {
  current_password: '',
  password: '',
  confirm_password: '',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatApiError(data: AdminsResponse) {
  const details = data.error?.details?.map((detail) => detail.message).join(' ');
  return [data.error?.message, details].filter(Boolean).join(': ') || 'Request failed';
}

async function readJson(res: Response): Promise<AdminsResponse> {
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(formatApiError(data));
  }
  return data;
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminAccount | null>(null);
  const [resetAdmin, setResetAdmin] = useState<AdminAccount | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState({ display_name: '', is_active: true });
  const [changePasswordForm, setChangePasswordForm] = useState(emptyPasswordForm);
  const [resetPasswordForm, setResetPasswordForm] = useState({ password: '', confirm_password: '' });

  const activeAdmins = useMemo(() => admins.filter((admin) => admin.is_active).length, [admins]);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await readJson(await fetch('/api/v1/admins'));
      setAdmins(data.data?.admins ?? []);
      setCurrentAdminId(data.data?.current_admin_id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAdmins();
  }, [fetchAdmins]);

  function flashSaved(message: string) {
    setSaved(message);
    window.setTimeout(() => setSaved(null), 3000);
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await readJson(await fetch('/api/v1/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      }));
      setCreateForm(emptyCreateForm);
      setShowCreate(false);
      await fetchAdmins();
      flashSaved('Admin created');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create admin');
    } finally {
      setSubmitting(false);
    }
  }

  function startEditing(admin: AdminAccount) {
    setEditingAdmin(admin);
    setEditForm({
      display_name: admin.display_name ?? '',
      is_active: admin.is_active,
    });
    setResetAdmin(null);
  }

  async function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingAdmin) return;
    setSubmitting(true);
    setError(null);

    try {
      await readJson(await fetch(`/api/v1/admins?id=${editingAdmin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      }));
      setEditingAdmin(null);
      await fetchAdmins();
      flashSaved('Admin updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update admin');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await readJson(await fetch('/api/v1/admins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', ...changePasswordForm }),
      }));
      setChangePasswordForm(emptyPasswordForm);
      flashSaved('Password changed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  }

  function startReset(admin: AdminAccount) {
    setResetAdmin(admin);
    setResetPasswordForm({ password: '', confirm_password: '' });
    setEditingAdmin(null);
  }

  async function handleResetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resetAdmin) return;
    setSubmitting(true);
    setError(null);

    try {
      await readJson(await fetch(`/api/v1/admins?id=${resetAdmin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_password', ...resetPasswordForm }),
      }));
      setResetAdmin(null);
      await fetchAdmins();
      flashSaved('Password reset');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight uppercase">Admins</h1>
          <p className="mt-1 text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">
            {activeAdmins} active / {admins.length} total
          </p>
        </div>
        <button onClick={() => setShowCreate((value) => !value)} className="btn btn-primary text-xs">
          Add Admin
        </button>
      </div>

      {error && (
        <div className="border border-[var(--danger)] bg-[var(--danger)]/5 px-3 py-2 text-xs text-[var(--danger)]">
          {error}
        </div>
      )}

      {saved && (
        <div className="border border-[var(--success)] bg-[var(--success)]/5 px-3 py-2 text-xs font-mono uppercase tracking-widest text-[var(--success)]">
          OK - {saved}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {showCreate && (
            <div className="panel">
              <div className="panel-header">
                <h2 className="text-xs font-bold uppercase tracking-wider">New Admin</h2>
              </div>
              <div className="panel-body">
                <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Username *</label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={64}
                      pattern="[A-Za-z0-9._-]+"
                      value={createForm.username}
                      onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Display Name</label>
                    <input
                      type="text"
                      maxLength={128}
                      value={createForm.display_name}
                      onChange={(e) => setCreateForm({ ...createForm, display_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Password *</label>
                    <input
                      type="password"
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Confirm Password *</label>
                    <input
                      type="password"
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      value={createForm.confirm_password}
                      onChange={(e) => setCreateForm({ ...createForm, confirm_password: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 text-xs text-[var(--foreground)]">
                      <input
                        type="checkbox"
                        checked={createForm.is_active}
                        onChange={(e) => setCreateForm({ ...createForm, is_active: e.target.checked })}
                        className="h-3.5 w-3.5 border-[var(--border-strong)]"
                      />
                      Active
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowCreate(false)} className="btn btn-ghost text-xs">
                      Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="btn btn-primary text-xs">
                      {submitting ? 'Saving...' : 'Create Admin'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {editingAdmin && (
            <div className="panel">
              <div className="panel-header flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider">Edit {editingAdmin.username}</h2>
                <button onClick={() => setEditingAdmin(null)} className="btn btn-ghost text-xs">
                  Close
                </button>
              </div>
              <div className="panel-body">
                <form onSubmit={handleUpdate} className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Display Name</label>
                    <input
                      type="text"
                      maxLength={128}
                      value={editForm.display_name}
                      onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                    />
                  </div>
                  <label className="flex items-end gap-2 pb-2 text-xs text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      disabled={editingAdmin.id === currentAdminId}
                      onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                      className="h-3.5 w-3.5 border-[var(--border-strong)]"
                    />
                    Active
                  </label>
                  <div className="flex items-end justify-end">
                    <button type="submit" disabled={submitting} className="btn btn-primary text-xs">
                      {submitting ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {resetAdmin && (
            <div className="panel">
              <div className="panel-header flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider">Reset {resetAdmin.username}</h2>
                <button onClick={() => setResetAdmin(null)} className="btn btn-ghost text-xs">
                  Close
                </button>
              </div>
              <div className="panel-body">
                <form onSubmit={handleResetPassword} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">New Password *</label>
                    <input
                      type="password"
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      value={resetPasswordForm.password}
                      onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, password: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Confirm Password *</label>
                    <input
                      type="password"
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      value={resetPasswordForm.confirm_password}
                      onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, confirm_password: e.target.value })}
                    />
                  </div>
                  <div className="flex items-end justify-end">
                    <button type="submit" disabled={submitting} className="btn btn-danger text-xs">
                      {submitting ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="scroll-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Status</th>
                  <th>Sessions</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id}>
                    <td>
                      <div className="font-medium">{admin.display_name || admin.username}</div>
                      <div className="font-mono text-[11px] text-[var(--muted)]">
                        @{admin.username}{admin.id === currentAdminId ? ' / you' : ''}
                      </div>
                    </td>
                    <td>
                      <span className={`inline-flex border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        admin.is_active
                          ? 'border-[var(--success)] bg-[var(--success)]/5 text-[var(--success)]'
                          : 'border-[var(--border-strong)] bg-[var(--background)] text-[var(--secondary)]'
                      }`}>
                        {admin.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{admin.active_sessions}</td>
                    <td className="text-[var(--secondary)]">{formatDate(admin.created_at)}</td>
                    <td className="text-[var(--secondary)]">{formatDate(admin.updated_at)}</td>
                    <td className="text-right">
                      <button onClick={() => startEditing(admin)} className="btn btn-ghost mr-1 text-xs">
                        Edit
                      </button>
                      <button
                        onClick={() => startReset(admin)}
                        disabled={admin.id === currentAdminId}
                        className="btn btn-ghost text-xs text-[var(--danger)]"
                      >
                        Reset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && admins.length === 0 && (
              <div className="p-6 text-center text-xs text-[var(--muted)]">No admins found</div>
            )}
            {loading && (
              <div className="p-6 text-center font-mono text-xs uppercase tracking-widest text-[var(--muted)]">Loading</div>
            )}
          </div>
        </div>

        <div className="panel self-start">
          <div className="panel-header">
            <h2 className="text-xs font-bold uppercase tracking-wider">Change My Password</h2>
          </div>
          <div className="panel-body">
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Current Password *</label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={changePasswordForm.current_password}
                  onChange={(e) => setChangePasswordForm({ ...changePasswordForm, current_password: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">New Password *</label>
                <input
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={changePasswordForm.password}
                  onChange={(e) => setChangePasswordForm({ ...changePasswordForm, password: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">Confirm Password *</label>
                <input
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={changePasswordForm.confirm_password}
                  onChange={(e) => setChangePasswordForm({ ...changePasswordForm, confirm_password: e.target.value })}
                />
              </div>
              <button type="submit" disabled={submitting} className="btn btn-primary w-full text-xs">
                {submitting ? 'Saving...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
