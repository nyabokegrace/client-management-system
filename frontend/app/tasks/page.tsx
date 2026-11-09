'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { DeleteConfirmModal } from '../../components/DeleteConfirmModal';
import { api } from '../../lib/api';
import { getNairobiDatetimeInputValue, formatNairobiDateTime } from '../../lib/dates';
import { Task, Matter, TaskPriority, TaskStatus } from '../../types';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'overdue'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit & Delete state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    matter: 0,
    priority: 'normal' as TaskPriority,
    status: 'todo' as TaskStatus,
    due_date: '',
    description: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tasksRes, mattersRes] = await Promise.all([
        filterMode === 'overdue' ? api.tasks.overdue() : api.tasks.list(),
        api.matters.list(),
      ]);

      setTasks(Array.isArray(tasksRes) ? tasksRes : (tasksRes as any).results || []);
      setMatters(Array.isArray(mattersRes) ? mattersRes : (mattersRes as any).results || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterMode]);

  const openCreateModal = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      matter: 0,
      priority: 'normal',
      status: 'todo',
      due_date: '',
      description: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      matter: task.matter || 0,
      priority: task.priority,
      status: task.status,
      due_date: getNairobiDatetimeInputValue(task.due_date),
      description: task.description || '',
    });
    setIsModalOpen(true);
  };

  const openDeleteModal = (task: Task) => {
    setDeletingTask(task);
    setIsDeleteOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload: any = {
        title: formData.title,
        priority: formData.priority,
        status: formData.status,
        description: formData.description,
        due_date: formData.due_date || undefined,
      };
      if (formData.matter && formData.matter > 0) {
        payload.matter = formData.matter;
      } else {
        payload.matter = null;
      }

      if (editingTask) {
        await api.tasks.update(editingTask.id, payload);
      } else {
        await api.tasks.create(payload);
      }
      setIsModalOpen(false);
      setEditingTask(null);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!deletingTask) return;
    await api.tasks.delete(deletingTask.id);
    setDeletingTask(null);
    fetchData();
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
        subtitle="Time-critical court filing deadlines, pleading rejoinders and compliance action items"
        breadcrumbs={[{ name: 'Dashboard', href: '/' }, { name: 'Tasks' }]}
        actions={
          <button
            onClick={openCreateModal}
            className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-[#111111] hover:bg-black rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Action Task
          </button>
        }
      />

      <div className="px-6 py-6 space-y-4">
        {/* Navigation Tabs */}
        <div className="border-b border-[#E5E7EB] flex space-x-6 text-xs font-medium">
          <button
            onClick={() => setFilterMode('all')}
            className={`pb-3 font-semibold transition-colors border-b-2 ${
              filterMode === 'all'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-black'
            }`}
          >
            All Action Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setFilterMode('overdue')}
            className={`pb-3 font-semibold transition-colors border-b-2 flex items-center ${
              filterMode === 'overdue'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-gray-500 hover:text-rose-600'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
            Overdue Deadlines
          </button>
        </div>

        {/* Tasks Table */}
        <div className="bg-white border border-[#E5E7EB] rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#374151] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3">Task Title & Details</th>
                  <th className="px-5 py-3">Matter Reference</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Due Deadline</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                      Loading action tasks...
                    </td>
                  </tr>
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-500">
                      <CheckSquare className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="font-medium text-gray-700">No pending action tasks found.</p>
                      <p className="text-[11px] text-gray-400 mt-1">All deadlines and court directives are currently up to date.</p>
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
                            {task.due_date ? formatNairobiDateTime(task.due_date) : 'No deadline'}
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
                      <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {task.status !== 'completed' && task.status !== 'cancelled' && (
                          <button
                            onClick={() => handleComplete(task.id)}
                            title="Mark as completed"
                            className="inline-flex items-center px-2 py-1 text-[11px] border border-[#E5E7EB] rounded font-medium hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Done
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(task)}
                          title="Edit task"
                          className="p-1.5 text-gray-400 hover:text-black rounded hover:bg-gray-100 transition-colors inline-flex items-center"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(task)}
                          title="Delete task"
                          className="p-1.5 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors inline-flex items-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Task Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        title={editingTask ? `Edit Task: ${editingTask.title}` : 'Create Action Task'}
        description={
          editingTask
            ? 'Update task description, deadline, or priority level.'
            : 'Assign a time-bound legal deliverable, registry filing, or procedural order.'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSaveTask} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. File Replying Affidavit at Milimani Registry"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Linked Legal Matter (Optional)
              </label>
              <select
                value={formData.matter || 0}
                onChange={(e) => setFormData({ ...formData, matter: Number(e.target.value) })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value={0}>— General Administrative Task —</option>
                {matters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.matter_reference} — {m.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Priority Level
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent Deadline</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              Instructions / Notes
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
              onClick={() => {
                setIsModalOpen(false);
                setEditingTask(null);
              }}
              className="px-4 py-2 border border-[#E5E7EB] rounded font-medium hover:bg-gray-50 text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#111111] text-white font-medium rounded hover:bg-black disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deletingTask && (
        <DeleteConfirmModal
          isOpen={isDeleteOpen}
          onClose={() => {
            setIsDeleteOpen(false);
            setDeletingTask(null);
          }}
          onConfirm={handleDeleteTask}
          title="Delete Action Task"
          recordName={deletingTask.title}
          recordReference={deletingTask.matter_reference}
          message={`Are you sure you want to permanently delete task "${deletingTask.title}"? This action cannot be undone.`}
        />
      )}
    </div>
  );
}
