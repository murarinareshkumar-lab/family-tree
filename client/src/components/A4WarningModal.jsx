import React from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';

export default function A4WarningModal({
  isOpen,
  message,
  matchedMember,
  onGoBack,
  onProceedAnyway
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-amber-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 text-amber-700 rounded-lg">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Duplicate Notice</h3>
            <p className="text-xs text-slate-500">Family branch matching warning</p>
          </div>
        </div>

        <div className="p-3.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-sm space-y-1">
          <p>{message || 'A person with the same name and date of birth already exists in this family branch.'}</p>
          {matchedMember && (
            <p className="text-xs text-amber-800 font-medium">
              Existing member: {matchedMember}
            </p>
          )}
        </div>

        <p className="text-xs text-slate-600">
          If this is a different individual who happens to share the same name and birth date, you may proceed. The administrator will review both records during approval.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onGoBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <button
            type="button"
            onClick={onProceedAnyway}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg shadow-sm transition"
          >
            Proceed Anyway
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
