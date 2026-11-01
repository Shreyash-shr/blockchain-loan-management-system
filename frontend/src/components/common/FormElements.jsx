import React from 'react';

export function Input({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500 ${className}`}
    />
  );
}

export function Select({ children, className = '', ...props }) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500 ${className}`}
    >
      {children}
    </select>
  );
}

export function Field({ label, children, hint, required, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
