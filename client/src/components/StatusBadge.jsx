import React from 'react';

export default function StatusBadge({ status }) {
  const s = String(status || '').toUpperCase();

  let style = 'bg-slate-100 text-slate-700 border-slate-200';

  if (s === 'APPROVED') {
    style = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (s === 'PENDING') {
    style = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (s === 'REJECTED') {
    style = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (s === 'MERGED') {
    style = 'bg-purple-50 text-purple-700 border-purple-200';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style}`}>
      {status || 'Unknown'}
    </span>
  );
}
