import React from 'react';
import { X } from 'lucide-react';

export function MethodModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">Methodology</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto space-y-8 font-serif-academic">

          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2 font-sans">
              <span className="w-6 h-px bg-slate-300"></span>
              Article Selection & Archival Sampling
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              Articles and archival records are sampled across ideological vantage points (e.g., Soviet central party organs, regional agricultural gazettes, opposition platforms, and international observers). The methodology isolates attribution networks and narrative framing structures before consensus crystallizes.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2 font-sans">
              <span className="w-6 h-px bg-slate-300"></span>
              Multi-Perspective Computational Framing Schema
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed mb-4">
              Each source text is structurally decomposed into core analytical dimensions for multi-perspective synthesis:
            </p>
            <ul className="space-y-3">
              <li className="text-sm text-slate-700 flex items-start gap-2">
                <span className="font-bold text-slate-900 mt-0.5 font-sans">Frames:</span>
                <span>Thematic lenses (Economic & Developmental, Political & Governance, Social & Cultural, Ethical & Moral, Environmental & Technological) guiding evidence interpretation.</span>
              </li>
              <li className="text-sm text-slate-700 flex items-start gap-2">
                <span className="font-bold text-slate-900 mt-0.5 font-sans">Main Actor:</span>
                <span>The focal stakeholder, institution, or faction asserting claims or directing policy actions.</span>
              </li>
              <li className="text-sm text-slate-700 flex items-start gap-2">
                <span className="font-bold text-slate-900 mt-0.5 font-sans">Blame / Attribution Target:</span>
                <span>The explicit entity, systemic constraint, or rival faction held accountable within the discursive line of reasoning.</span>
              </li>
            </ul>
          </section>

          <section className="bg-purple-50/70 p-5 rounded-xl border border-purple-200">
            <h3 className="text-sm font-bold text-purple-900 uppercase tracking-wider mb-2 font-sans">
              Academic Synthesis & Research Instrument
            </h3>
            <p className="text-sm text-purple-950 leading-relaxed font-serif-academic">
              Developed as a computational instrument for comparative political communication, multi-perspective literature reviews, and digital humanities research. Trace models discursive power dynamics, institutional tensions, and evidence synthesis without predetermining normative verdicts.
            </p>
          </section>

          <section className="bg-rose-50 p-5 rounded-xl border border-rose-100">
            <h3 className="text-sm font-bold text-rose-900 uppercase tracking-wider mb-2 font-sans">
              Interpretation Note
            </h3>
            <p className="text-sm text-rose-800 leading-relaxed font-medium">
              This tool compares narrative structure, not factual truth. Trace does not function as a "bias detector" or a fact-checker. Its purpose is to structurally visualize how different institutional media construct distinct geopolitical or ideological realities from the exact same raw event.
            </p>
          </section>

        </div>
        
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}

