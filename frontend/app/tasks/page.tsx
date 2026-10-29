'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  User as UserIcon,
  Calendar,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { Task, Matter, User, TaskPriority, TaskStatus } from '../../types';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'overdue'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    matter: 0,
    assigned_to: null as number | null,
    priority: 'normal' as TaskPriority,
    status: 'todo' as TaskStatus,
    due_date: '',
    description: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tasksRes, mattersRes, usersRes] = await Promise.all([
        filterMode === 'overdue' ? api.tasks.overdue() : api.tasks.list(),
        api.matters.list(),
        api.users.list(),
      ]);

      setTasks(Array.isArray(tasksRes) ? tasksRes : (tasksRes as any).results || []);
      setMatters(Array.isArray(mattersRes) ? mattersRes : mattersRes.results || []);
      setUsers(Array.isArray(usersRes) ? usersRes : usersRes.results || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterMode]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.tasks.create({
        title: formData.title,
        matter: formData.matter || undefined,
        assigned_to: formData.assigned_to || undefined,
        priority: formData.priority,
        status: formData.status,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : undefined,
        description: formData.description,
      });
      setIsModalOpen(false);
      setFormData({
        title: '',
        matter: 0,
        assigned_to: null,
        priority: 'normal',
        status: 'todo',
        due_date: '',
        description: '',
      });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error creating task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await api.tasks.complete(id);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error completing task');
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Tasks & Deadlines"
        subtitle="Internal case assignments, compliance milestones, court submission deadlines and reminders"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Tasks' }]}
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-[#111111] hover:bg-black rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Task
          </button>
        }
      />

      <div className="px-6 py-6 space-y-4">
        {/* Tabs */}
        <div className="border-b border-[#E5E7EB] flex space-x-6 text-xs font-medium">
          <button
            onClick={() => setFilterMode('all')}
            className={`pb-3 font-semibold transition-colors border-b-2 ${
              filterMode === 'all'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            All Case Tasks
          </button>
          <button
            onClick={() => setFilterMode('overdue')}
            className={`pb-3 font-semibold transition-colors border-b-2 flex items-center ${
              filterMode === 'overdue'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            Overdue Tasks
          </button>
        </div>

        {/* Tasks Table */}
        <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#374151] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Task Details</th>
                  <th className="px-5 py-3">Legal Matter</th>
                  <th className="px-5 py-3">Assigned Personnel</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Due Date</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500">
                      Loading firm tasks...
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-500">
                      <CheckSquare className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="font-medium text-gray-700">No tasks found.</p>
                      <p className="text-[11px] text-gray-400 mt-1">Assign a drafting task, filing deadline or client follow-up.</p>
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-gray-900">{task.title}</div>
                        {task.description && (
                          <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                            {task.description}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-gray-700">
                        {task.matter_reference || 'General'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {task.assigned_to_name || 'Unassigned'}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={
                            task.priority === 'urgent'
                              ? 'danger'
                              : task.priority === 'high'
                              ? 'warning'
                              : 'default'
                          }
                          size="sm"
                        >
                          {task.priority_display || task.priority}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center space-x-1.5">
                          {task.is_overdue && (
                            <Badge variant="danger" size="sm">Overdue</Badge>
                          )}
                          <span className={`text-[11px] ${task.is_overdue ? 'text-rose-700 font-bold' : 'text-gray-600'}`}>
                            {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No deadline'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={
                            task.status === 'completed'
                              ? 'success'
                              : task.status === 'in_progress'
                              ? 'info'
                              : 'default'
                          }
                          size="sm"
                        >
                          {task.status_display || task.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {task.status !== 'completed' && task.status !== 'cancelled' && (
                          <button
                            onClick={() => handleComplete(task.id)}
                            title="Mark as completed"
                            className="inline-flex items-center px-2 py-1 text-xs border border-[#E5E7EB] rounded font-medium hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Done
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Task / Deadline"
        description="Assign a drafting task, legal research item or deadline to internal counsel or staff."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Draft written submissions on jurisdiction"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Legal Matter (Optional)
              </label>
              <select
                value={formData.matter}
                onChange={(e) => setFormData({ ...formData, matter: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value={0}>— Firm General Task —</option>
                {matters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.matter_reference} - {m.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Assign To
              </label>
              <select
                value={formData.assigned_to || ''}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="">— Unassigned —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Due Date & Time
              </label>
              <input
                type="datetime-local"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Task Details & Instructions
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-[#E5E7EB] rounded font-medium hover:bg-gray-50 text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#111111] text-white font-medium rounded hover:bg-black disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
