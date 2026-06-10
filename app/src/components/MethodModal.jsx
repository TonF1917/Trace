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
        
        <div className="p-8 overflow-y-auto space-y-8">
          
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-6 h-px bg-slate-300"></span>
              Article Selection
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Articles are sampled from major international and domestic outlets representing distinct geopolitical and ideological vantage points (e.g., The New York Times, Fox News, BBC, Al Jazeera). The selection captures the initial 48-72 hours of breaking news coverage for each specified event to analyze the primary framing mechanics before the narrative solidifies.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-6 h-px bg-slate-300"></span>
              Labeling Schema
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Each article is structurally decomposed into core analytical fields:
            </p>
            <ul className="space-y-3">
              <li className="text-sm text-slate-600 flex items-start gap-2">
                <span className="font-bold text-slate-800 mt-0.5">Frames:</span>
                <span>Categorized into overarching thematic structures (e.g., Security, Morality, Conflict, Economy) that guide reader interpretation.</span>
              </li>
              <li className="text-sm text-slate-600 flex items-start gap-2">
                <span className="font-bold text-slate-800 mt-0.5">Main Actor:</span>
                <span>The primary entity driving the action or subject of the headline.</span>
              </li>
              <li className="text-sm text-slate-600 flex items-start gap-2">
                <span className="font-bold text-slate-800 mt-0.5">Blame Target:</span>
                <span>The specific entity held explicitly or implicitly responsible for the crisis or conflict within the narrative.</span>
              </li>
            </ul>
          </section>

          <section className="bg-rose-50 p-5 rounded-xl border border-rose-100">
            <h3 className="text-sm font-bold text-rose-900 uppercase tracking-wider mb-2">
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

