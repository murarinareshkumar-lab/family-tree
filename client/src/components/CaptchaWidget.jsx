import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function CaptchaWidget({ onVerify, verified }) {
  const [loading, setLoading] = useState(false);

  const handleVerify = () => {
    if (verified) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onVerify(true);
    }, 600);
  };

  return (
    <div className="border border-slate-200 bg-slate-50/70 rounded-xl p-3 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={handleVerify}
          disabled={verified || loading}
          className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${
            verified
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-slate-300 hover:border-emerald-500 bg-white'
          }`}
        >
          {verified ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : loading ? (
            <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          ) : null}
        </button>
        <span className="text-xs sm:text-sm font-medium text-slate-700">
          {verified ? "I am human (Verified)" : "Verify you are human"}
        </span>
      </div>
      <div className="flex items-center space-x-1 text-slate-400">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span className="text-[10px] font-semibold tracking-wider uppercase">Anti-Bot</span>
      </div>
    </div>
  );
}
