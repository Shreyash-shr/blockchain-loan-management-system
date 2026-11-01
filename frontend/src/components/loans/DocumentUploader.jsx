import React from 'react';
import { UploadCloud, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export default function DocumentUploader({
  label,
  docKey,
  required = false,
  file,
  status,
  onFileSelect,
  disabled = false,
}) {
  const getStatusBadge = () => {
    if (status === 'verified' || status === 'valid') {
      return (
        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
          <CheckCircle2 size={13} /> Verified
        </span>
      );
    }
    if (status === 'rejected' || status === 'invalid') {
      return (
        <span className="flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
          <AlertCircle size={13} /> Rejected
        </span>
      );
    }
    if (status === 'needs_review') {
      return (
        <span className="flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md">
          <AlertCircle size={13} /> Needs Review
        </span>
      );
    }
    if (file || status === 'pending') {
      return (
        <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
          <Clock size={13} /> Under Review
        </span>
      );
    }
    return null;
  };

  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3.5 transition hover:bg-slate-50/80">
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-white p-2.5 text-slate-500 shadow-sm shrink-0">
          <UploadCloud size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-700 truncate">
              {label}
              {required && <span className="text-rose-500"> *</span>}
            </p>
            {getStatusBadge()}
          </div>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {file ? file.name || file.original_filename || 'Uploaded document' : 'PDF, JPG or PNG · max 10 MB'}
          </p>
        </div>
        {!disabled && (
          <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-sm shrink-0">
            {file ? 'Replace' : 'Browse'}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFileSelect(docKey, f);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
