'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Modal } from './Modal';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  recordName: string;
  recordReference?: string;
  requireReferenceMatch?: boolean;
  message?: React.ReactNode;
  blockedReason?: string | null;
  loading?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  recordName,
  recordReference,
  requireReferenceMatch = false,
  message,
  blockedReason,
  loading = false,
}) => {
  const [typedRef, setTypedRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTypedRef('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  const canConfirm =
    !blockedReason &&
    (!requireReferenceMatch ||
      (recordReference && typedRef.trim().toUpperCase() === recordReference.trim().toUpperCase()));

  const handleConfirm = async () => {
    if (!canConfirm) return;
    try {
      setSubmitting(true);
      setError(null);
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={`Record: ${recordName}${recordReference ? ` (${recordReference})` : ''}`}
      maxWidth="md"
    >
      <div className="space-y-4 text-xs">
        {blockedReason ? (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded text-amber-900 flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{blockedReason}</p>
              <p className="text-[11px] text-amber-700 mt-1">
                This record cannot be deleted because dependent matters or relationships exist. Please remove or reassign them before proceeding.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded text-rose-900 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-rose-950">Permanent Deletion Warning</p>
                <div className="text-xs text-rose-800">{message}</div>
              </div>
            </div>

            {requireReferenceMatch && recordReference && (
              <div className="space-y-2 pt-1">
                <label className="block text-[11px] font-semibold text-gray-700">
                  Type <span className="font-mono font-bold text-black">{recordReference}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={typedRef}
                  onChange={(e) => setTypedRef(e.target.value)}
                  placeholder={recordReference}
                  className="w-full px-3 py-1.5 font-mono text-xs border border-[#E5E7EB] rounded focus:outline-none focus:border-black"
                />
              </div>
            )}
          </>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
            {error}
          </div>
        )}

        <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3.5 py-1.5 text-xs font-medium border border-[#E5E7EB] rounded text-gray-700 hover:bg-gray-50"
          >
            {blockedReason ? 'Close' : 'Cancel'}
          </button>
          {!blockedReason && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm || submitting || loading}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {submitting ? 'Deleting...' : 'Delete Permanently'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
