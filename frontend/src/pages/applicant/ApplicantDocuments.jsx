import React, { useState, useEffect } from 'react';
import { ShieldCheck, Check, Upload, Download, Eye, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import Button from '../../components/common/Button';
import DocumentUploader from '../../components/loans/DocumentUploader';
import DocumentPreviewModal from '../../components/loans/DocumentPreviewModal';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';

const REQUIRED_CATEGORIES = [
  { key: 'pan', docType: 'pan_card', label: 'PAN Card', required: true },
  { key: 'aadhaar', docType: 'aadhaar_card', label: 'Aadhaar Card', required: true },
  { key: 'address', docType: 'address_proof', label: 'Address Proof (Electricity / Utility Bill)', required: true },
  { key: 'bank', docType: 'bank_statement', label: 'Bank Statement (Last 6 Months)', required: true },
  { key: 'salary', docType: 'salary_slip', label: 'Salary Slips (Last 3–6 Months)', required: true },
  { key: 'photo', docType: 'photograph', label: 'Passport Photograph', required: true },
  { key: 'signature', docType: 'signature', label: 'Official Signature Sample', required: true },
];

export default function ApplicantDocuments() {
  const { success, error } = useToast();
  const [serverDocs, setServerDocs] = useState([]);
  const [pendingUploads, setPendingUploads] = useState({});
  const [previewDoc, setPreviewDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/documents/me');
      if (res && Array.isArray(res.documents)) {
        setServerDocs(res.documents);
      }
    } catch (err) {
      console.warn('Could not fetch documents:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileSelect = (key, file) => {
    if (file.size > 10 * 1024 * 1024) {
      error(`File "${file.name}" exceeds the 10 MB limit.`);
      return;
    }
    setPendingUploads((prev) => ({ ...prev, [key]: file }));
    success(`Selected "${file.name}". Click "Upload Selected Documents" to save.`);
  };

  const handleUploadAll = async () => {
    const entries = Object.entries(pendingUploads);
    if (entries.length === 0) {
      error('No new files selected to upload.');
      return;
    }

    setUploading(true);
    let successCount = 0;

    for (const [key, file] of entries) {
      const cat = REQUIRED_CATEGORIES.find((c) => c.key === key);
      const docType = cat ? cat.docType : key;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', docType);

      try {
        await api.post('/documents', formData);
        successCount++;
      } catch (err) {
        error(`Failed to upload ${cat?.label || key}: ${err.message}`);
      }
    }

    setUploading(false);
    setPendingUploads({});
    if (successCount > 0) {
      success(`Uploaded ${successCount} document(s) successfully!`);
      fetchDocuments();
    }
  };

  const handleDownload = async (docId, filename) => {
    try {
      const token = api.getToken();
      const res = await fetch(`${api.baseUrl}/documents/${docId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      error(`Could not download document: ${err.message}`);
    }
  };

  const findServerDoc = (docType) => {
    return serverDocs.find((d) => d.document_type === docType);
  };

  const verifiedCount = serverDocs.filter(
    (d) => d.verification_status === 'valid' || d.verification_status === 'verified'
  ).length;

  // Extra docs not in standard categories
  const extraDocs = serverDocs.filter(
    (d) => !REQUIRED_CATEGORIES.some((c) => c.docType === d.document_type)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">My KYC & Income Documents</h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload, preview, and maintain your KYC, identity, and income verification documents.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3.5 py-2 rounded-xl text-xs font-semibold">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span>
            {verifiedCount} of {REQUIRED_CATEGORIES.length} Categories Verified
          </span>
        </div>
      </div>

      {/* Grid of Document Upload Cards */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-7 shadow-soft">
        {loading ? (
          <div className="py-14 text-center">
            <p className="text-sm text-slate-500 animate-pulse">Loading verified documents...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {REQUIRED_CATEGORIES.map((cat) => {
                const uploadedDoc = findServerDoc(cat.docType);
                const pendingFile = pendingUploads[cat.key];
                const fileObj = pendingFile || (uploadedDoc ? { name: uploadedDoc.original_filename } : null);
                const status = uploadedDoc ? uploadedDoc.verification_status : undefined;

                return (
                  <div key={cat.key} className="space-y-1">
                    <DocumentUploader
                      docKey={cat.key}
                      label={cat.label}
                      required={cat.required}
                      status={status}
                      file={fileObj}
                      onFileSelect={handleFileSelect}
                    />
                    {uploadedDoc && (
                      <div className="flex items-center justify-between px-2 text-xs text-slate-500">
                        <span>Uploaded: {new Date(uploadedDoc.uploaded_at).toLocaleDateString('en-IN')}</span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewDoc({
                                id: uploadedDoc.id,
                                label: cat.label,
                                filename: uploadedDoc.original_filename,
                                status: uploadedDoc.verification_status,
                                mime_type: uploadedDoc.mime_type,
                              })
                            }
                            className="text-brand font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Eye size={12} /> View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(uploadedDoc.id, uploadedDoc.original_filename)}
                            className="text-slate-600 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Download size={12} /> Download
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Extra Documents List if any */}
            {extraDocs.length > 0 && (
              <div className="rounded-xl border border-slate-200 p-4 space-y-2 bg-slate-50/50">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Additional Attached Documents ({extraDocs.length})
                </h4>
                <div className="space-y-2">
                  {extraDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <FileText size={15} className="text-brand shrink-0" />
                        <div>
                          <p className="font-semibold text-slate-800">{doc.original_filename}</p>
                          <p className="text-[11px] text-slate-400 capitalize">{doc.document_type.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDoc({
                              id: doc.id,
                              label: doc.document_type.replace(/_/g, ' '),
                              filename: doc.original_filename,
                              status: doc.verification_status,
                              mime_type: doc.mime_type,
                            })
                          }
                          className="text-brand font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={12} /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(doc.id, doc.original_filename)}
                          className="text-slate-600 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Download size={12} /> Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-5">
          <p className="text-xs text-slate-500">
            Uploaded files are securely encrypted and access-controlled by role. Only authorized lenders and admins can inspect them.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={fetchDocuments} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </Button>
            <Button
              onClick={handleUploadAll}
              disabled={uploading || Object.keys(pendingUploads).length === 0}
            >
              {uploading ? 'Uploading...' : 'Upload Selected Documents'} <Upload size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Document Preview Lightbox Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        doc={previewDoc}
      />
    </div>
  );
}
