'use client';

export default function OfficerManifestArchiveModal({
  isOpen,
  onClose,
  manifests = [],
  onSelectManifest,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white border border-slate-300 rounded-lg shadow-2xl overflow-hidden font-sans my-auto flex flex-col max-h-[85vh]">
        
        {/* Tricolor Ribbon */}
        <div className="h-1.5 w-full flex">
          <div className="flex-1 bg-[#FF9933]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#138808]" />
        </div>

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              Field Patrol Checkpoint Records
            </span>
            <h2 className="text-base font-black text-slate-900">
              Archived Checkpoint Transit Manifests ({manifests.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-200 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto overflow-y-auto flex-1 p-4">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                <th className="py-2.5 px-3">Dispatch Code</th>
                <th className="py-2.5 px-3">Vehicle / Reg</th>
                <th className="py-2.5 px-3">Destination</th>
                <th className="py-2.5 px-3">Driver</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Issued At</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {manifests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                    No checkpoint transit manifests issued by this patrol desk yet.
                  </td>
                </tr>
              ) : (
                manifests.map((m) => (
                  <tr key={m.id || m.manifest_code} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-900">
                      {m.manifest_code}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900 block truncate max-w-[140px]">{m.vehicle_reg_number}</span>
                      <span className="text-[10px] text-slate-500 block truncate max-w-[140px]">{m.vehicle_type}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium">
                      {m.target_district}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {m.driver_name}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                        m.clearance_status === 'AUTHORIZED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                        {m.clearance_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                      {m.created_at ? new Date(m.created_at).toLocaleDateString() : 'Recent'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => {
                          onSelectManifest(m);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-black text-white font-bold text-[11px] rounded transition cursor-pointer"
                      >
                        View & Print
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>Official audit trail synchronized with Supabase registry.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}