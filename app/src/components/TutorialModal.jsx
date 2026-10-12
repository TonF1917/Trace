import React from 'react';
import { X, BookOpen, Cpu, FolderPlus, FileText, Network, BarChart3, Download, Sparkles, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function TutorialModal({ onClose }) {
  const { t } = useTranslation();

  const steps = [
    {
      num: '01',
      icon: Cpu,
      badge: t('Settings'),
      color: 'rose',
      title: t('tutorial.step1.title'),
      desc: t('tutorial.step1.desc'),
      tips: [
        t('tutorial.step1.tip1'),
        t('tutorial.step1.tip2')
      ]
    },
    {
      num: '02',
      icon: FolderPlus,
      badge: t('New Project'),
      color: 'purple',
      title: t('tutorial.step2.title'),
      desc: t('tutorial.step2.desc'),
      tips: [
        t('tutorial.step2.tip1'),
        t('tutorial.step2.tip2')
      ]
    },
    {
      num: '03',
      icon: FileText,
      badge: t('Data Manager'),
      color: 'amber',
      title: t('tutorial.step3.title'),
      desc: t('tutorial.step3.desc'),
      tips: [
        t('tutorial.step3.tip1'),
        t('tutorial.step3.tip2'),
        t('tutorial.step3.tip3')
      ]
    },
    {
      num: '04',
      icon: Network,
      badge: t('Topology Network'),
      color: 'blue',
      title: t('tutorial.step4.title'),
      desc: t('tutorial.step4.desc'),
      tips: [
        t('tutorial.step4.tip1'),
        t('tutorial.step4.tip2'),
        t('tutorial.step4.tip3')
      ]
    },
    {
      num: '05',
      icon: BarChart3,
      badge: t('Graph Analytics'),
      color: 'teal',
      title: t('tutorial.step5.title'),
      desc: t('tutorial.step5.desc'),
      tips: [
        t('tutorial.step5.tip1'),
        t('tutorial.step5.tip2')
      ]
    },
    {
      num: '06',
      icon: Download,
      badge: t('Export'),
      color: 'slate',
      title: t('tutorial.step6.title'),
      desc: t('tutorial.step6.desc'),
      tips: [
        t('tutorial.step6.tip1'),
        t('tutorial.step6.tip2')
      ]
    }
  ];

  const colorStyles = {
    rose: {
      bg: 'bg-rose-50/70',
      border: 'border-rose-200',
      badge: 'bg-rose-100 text-rose-700 border-rose-200',
      iconBg: 'bg-rose-600 text-white',
      num: 'text-rose-600'
    },
    purple: {
      bg: 'bg-purple-50/70',
      border: 'border-purple-200',
      badge: 'bg-purple-100 text-purple-700 border-purple-200',
      iconBg: 'bg-purple-600 text-white',
      num: 'text-purple-600'
    },
    amber: {
      bg: 'bg-amber-50/70',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-600 text-white',
      num: 'text-amber-600'
    },
    blue: {
      bg: 'bg-blue-50/70',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-700 border-blue-200',
      iconBg: 'bg-blue-600 text-white',
      num: 'text-blue-600'
    },
    teal: {
      bg: 'bg-teal-50/70',
      border: 'border-teal-200',
      badge: 'bg-teal-100 text-teal-800 border-teal-200',
      iconBg: 'bg-teal-600 text-white',
      num: 'text-teal-600'
    },
    slate: {
      bg: 'bg-slate-100/80',
      border: 'border-slate-300',
      badge: 'bg-slate-200 text-slate-800 border-slate-300',
      iconBg: 'bg-slate-800 text-white',
      num: 'text-slate-700'
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-600 text-white shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-wider">
                {t('tutorial.header.title')}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {t('tutorial.header.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-200"
            title={t('Close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
          {/* Quick Intro Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('tutorial.banner.tag')}</span>
              </div>
              <p className="text-sm text-slate-100 font-serif-academic leading-relaxed">
                {t('tutorial.banner.text')}
              </p>
            </div>
          </div>

          {/* 6 Workflow Steps */}
          <div className="space-y-4">
            {steps.map((step) => {
              const Icon = step.icon;
              const style = colorStyles[step.color];
              return (
                <div
                  key={step.num}
                  className={`p-5 rounded-xl border ${style.bg} ${style.border} transition-all`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-xl ${style.iconBg} shrink-0 shadow-xs mt-0.5`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className={`text-xs font-black font-mono ${style.num}`}>
                          STEP {step.num}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${style.badge}`}>
                          {step.badge}
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-sm text-slate-700 font-serif-academic leading-relaxed mb-3">
                        {step.desc}
                      </p>
                      <div className="space-y-1.5 bg-white/80 p-3 rounded-lg border border-slate-200/70">
                        {step.tips.map((tip, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${style.num}`} />
                            <span className="font-serif-academic">{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-serif-academic">
            {t('tutorial.footer.note')}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-xs"
          >
            {t('tutorial.footer.cta')}
          </button>
        </div>
      </div>
    </div>
  );
}
