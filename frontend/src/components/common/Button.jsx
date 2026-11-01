import React from 'react';

export default function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-brand text-white hover:bg-blue-700 shadow-sm focus:ring-4 focus:ring-blue-100',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm focus:ring-4 focus:ring-rose-100',
    quiet: 'text-slate-600 hover:bg-slate-100',
    outline: 'border border-brand text-brand hover:bg-blue-50',
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant] || variants.primary} ${className}`}
    >
      {children}
    </button>
  );
}
