import React, { useState, useEffect } from 'react';
import { Download, FileText, Loader2, AlertCircle } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { api } from '../../services/api';

export default function DocumentPreviewModal({ isOpen, onClose, doc }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [mimeType, setMimeType] = useState('');

  useEffect(() => {
    let active = true;
    let createdUrl = null;

    async function fetchDoc() {
      if (!doc?.id || !isOpen) {
        setBlobUrl(null);
        setFetchError(null);
        return;
      }

      try {
        setLoading(true);
        setFetchError(null);
        const token = api.getToken();
        const res = await fetch(`${api.baseUrl}/documents/${doc.id}/view`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error(`Failed to load document (${res.status} ${res.statusText})`);
        }

        const type = res.headers.get('content-type') || doc.mime_type || '';
        const blob = await res.blob();
        createdUrl = URL.createObjectURL(blob);

        if (active) {
          setMimeType(type);
          setBlobUrl(createdUrl);
        }
      } catch (err) {
        if (active) {
          setFetchError(err.message || 'Could not load document preview.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchDoc();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [doc?.id, isOpen]);

  const handleDownload = async () => {
    if (!doc?.id) return;
    try {
      const token = api.getToken();
      const res = await fetch(`${api.baseUrl}/documents/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download request failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename || doc.original_filename || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  if (!isOpen || !doc) return null;

  const filename = doc.filename || doc.original_filename || '';
  const isImage =
    mimeType.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(filename);
  const isPdf =
    mimeType.includes('pdf') ||
    /\.pdf$/i.test(filename);

  const rawStatus = (doc.status || doc.verification_status || 'pending').toLowerCase();
  const statusLabel =
    rawStatus === 'valid' || rawStatus === 'verified'
      ? 'Valid'
      : rawStatus === 'invalid' || rawStatus === 'rejected'
      ? 'Invalid'
      : rawStatus === 'needs_review'
      ? 'Needs Review'
      : 'Pending Review';

  const statusClass =
    rawStatus === 'valid' || rawStatus === 'verified'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : rawStatus === 'invalid' || rawStatus === 'rejected'
      ? 'bg-rose-100 text-rose-800 border-rose-200'
      : rawStatus === 'needs_review'
      ? 'bg-orange-100 text-orange-800 border-orange-200'
      : 'bg-amber-100 text-amber-800 border-amber-200';

  const displayLabel = doc.label || (doc.document_type ? doc.document_type.replace(/_/g, ' ') : 'Document');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Document Preview: ${displayLabel}`}
      subtitle={`File: ${filename}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Preview Container */}
        <div className="min-h-[320px] max-h-[65vh] w-full rounded-xl bg-slate-950/5 flex flex-col items-center justify-center p-2 border border-slate-200 overflow-hidden relative">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-slate-500 py-16">
              <Loader2 size={32} className="animate-spin text-brand" />
              <p className="text-sm font-medium">Loading secure document preview...</p>
            </div>
          )}

          {!loading && fetchError && (
            <div className="flex flex-col items-center text-center p-6 text-slate-600">
              <AlertCircle size={36} className="text-amber-500 mb-2" />
              <p className="text-sm font-semibold text-ink">Preview Unavailable</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">{fetchError}</p>
              <p className="text-xs text-slate-400 mt-2">You can still download or inspect the file directly.</p>
            </div>
          )}

          {!loading && !fetchError && blobUrl && isImage && (
            <div className="w-full flex items-center justify-center overflow-auto max-h-[60vh] p-2">
              <img
                src={blobUrl}
                alt={filename}
                className="max-h-[58vh] max-w-full rounded-lg object-contain shadow-sm border border-slate-200/60"
              />
            </div>
          )}

          {!loading && !fetchError && blobUrl && isPdf && (
            <iframe
              src={blobUrl}
              title={filename}
              className="w-full h-[60vh] rounded-lg border border-slate-200 bg-white"
            />
          )}

          {!loading && !fetchError && blobUrl && !isImage && !isPdf && (
            <div className="flex flex-col items-center text-center p-8 text-slate-600">
              <FileText size={48} className="text-brand mb-2" />
              <p className="text-sm font-semibold text-ink">{filename}</p>
              <p className="text-xs text-slate-500 mt-1">This file type can be opened or downloaded below.</p>
            </div>
          )}
        </div>

        {/* Footer info & controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Verification state:</span>
            <span className={`font-semibold px-2.5 py-0.5 rounded-full border text-xs capitalize ${statusClass}`}>
              {statusLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {doc.id && (
              <Button onClick={handleDownload} className="!px-3.5 !py-2 text-xs">
                <Download size={14} /> Open / Download File
              </Button>
            )}
            <Button variant="secondary" onClick={onClose} className="!px-4 !py-2 text-xs">
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
