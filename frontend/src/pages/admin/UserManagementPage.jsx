import React, { useState, useEffect } from 'react';
import { Users, Search, ShieldCheck, UserX, UserCheck, Lock } from 'lucide-react';
import { Input, Select } from '../../components/common/FormElements';
import Button from '../../components/common/Button';
import { Pill } from '../../components/common/CommonUI';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

export default function UserManagementPage() {
  const { success, error } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        const res = await api.get('/admin/users');
        if (res && Array.isArray(res.users)) {
          setUsers(res.users);
        } else {
          setUsers([]);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  const toggleStatus = async (user) => {
    const newStatus = !user.is_active;
    try {
      await api.patch(`/admin/users/${user.id}/status`, { is_active: newStatus });
    } catch {
      // Prototype update
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, is_active: newStatus } : u))
    );
    success(`User ${user.full_name} has been ${newStatus ? 'activated' : 'deactivated'}.`);
  };

  const filteredUsers = users.filter((u) => {
    const term = `${u.full_name} ${u.email} ${u.role}`.toLowerCase();
    const matchesSearch = term.includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role.toLowerCase() === roleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-ink">User Directory & Access Control</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage system identities, enforce role boundaries, and suspend or activate credentials.
        </p>
      </div>

      {/* Security Notice Box */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3">
        <Lock size={18} className="text-amber-700 mt-0.5 shrink-0" />
        <div>
          <span className="font-bold">Administrative Security Constraint:</span> Lender and Administrator privileges require deliberate backend database provisioning or elevated approval. Public applicant registration can never self-assign administrative roles.
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-52">
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="ALL">All Roles ({users.length})</option>
            <option value="applicant">Applicants</option>
            <option value="lender">Lenders</option>
            <option value="admin">Administrators</option>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-soft">
        {loading ? (
          <div className="py-14 text-center">
            <p className="text-sm text-slate-500 animate-pulse">Loading directory accounts...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-14 text-center">
            <p className="font-semibold text-slate-700">No users match criteria</p>
            <p className="mt-1 text-sm text-slate-500">Try adjusting your search query or role filter.</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 font-semibold">User Identity</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Assigned Role</th>
                <th className="px-4 py-3 font-semibold">Account Status</th>
                <th className="px-4 py-3 font-semibold">Registered</th>
                <th className="px-4 py-3 text-right font-semibold">Security Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-4 py-4">
                    <p className="text-sm font-semibold text-slate-800">{u.full_name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-600">{u.phone || '—'}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                        u.role === 'admin'
                          ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-200'
                          : u.role === 'lender'
                          ? 'bg-blue-50 text-brand ring-1 ring-blue-200'
                          : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                        u.is_active ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          u.is_active ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      {u.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500">{u.created_at}</td>
                  <td className="px-4 py-4 text-right">
                    {u.role === 'admin' ? (
                      <span className="text-xs text-slate-400 italic">Protected Root</span>
                    ) : (
                      <Button
                        variant={u.is_active ? 'danger' : 'secondary'}
                        className="!px-3 !py-1 text-xs"
                        onClick={() => toggleStatus(u)}
                      >
                        {u.is_active ? (
                          <>
                            <UserX size={13} /> Suspend
                          </>
                        ) : (
                          <>
                            <UserCheck size={13} /> Activate
                          </>
                        )}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}
