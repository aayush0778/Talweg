import React, { useState } from 'react';
import { RiskLevel } from '../types/api';
import { getResponseGuidance } from '../lib/responseGuidance';
import { NotificationChain } from './NotificationChain';

interface ResponseGuidanceProps {
  riskLevel: RiskLevel | null;
  zoneName: string;
}

export const ResponseGuidance: React.FC<ResponseGuidanceProps> = ({ riskLevel, zoneName }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!riskLevel) {
    return (
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-6">
        <div className="text-slate-400 flex items-center justify-between">
          <h3 className="font-semibold text-slate-300">🚨 RESPONSE GUIDANCE</h3>
          <span className="text-sm">Risk level unavailable</span>
        </div>
      </div>
    );
  }

  const guidance = getResponseGuidance(riskLevel, zoneName);
  const isSevere = riskLevel === 'SEVERE';

  return (
    <div 
      className={`bg-slate-950/60 border rounded-xl overflow-hidden mb-6 transition-all duration-300 ${
        isSevere 
          ? 'border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.1)]' 
          : 'border-slate-800/80'
      }`}
    >
      {/* Header (Always visible) */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-900/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-slate-100 flex items-center gap-2">
            <span className={isSevere ? 'animate-pulse text-rose-500' : ''}>🚨</span> 
            RESPONSE GUIDANCE
          </h3>
          <span className={`px-2.5 py-0.5 rounded text-xs font-medium border ${guidance.urgencyColor}`}>
            {guidance.urgencyLevel}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">
            ETA: <span className="text-slate-300 font-medium">{guidance.estimatedResponseTime}</span>
          </span>
          <button className="text-slate-400 hover:text-slate-200 transition-colors">
            {isExpanded ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-4 border-t border-slate-800/50 bg-slate-900/20">
          
          <div className="mb-5">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Required Actions</h4>
            <ul className="space-y-2">
              {guidance.actions.map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-slate-400 text-xs mt-0.5">
                    {index + 1}
                  </span>
                  <span className={item.priority === 'emergency' ? 'text-rose-300 font-medium' : ''}>
                    {item.action}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-2">
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Key Contacts</h4>
              <div className="space-y-2">
                {guidance.contacts.map((contact, index) => (
                  <div key={index} className="flex justify-between items-center text-sm bg-slate-800/30 p-2 rounded border border-slate-700/30">
                    <span className="text-slate-300">{contact.role}</span>
                    <span className="text-slate-400 text-xs px-2 py-1 bg-slate-800 rounded">{contact.method}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Population Advisory</h4>
              <div className={`p-3 rounded border text-sm ${isSevere ? 'bg-rose-950/20 border-rose-900/50 text-rose-200/90' : 'bg-slate-800/30 border-slate-700/30 text-slate-300'}`}>
                {guidance.populationNote}
              </div>
            </div>

            {/* Stakeholder Notification Escalation Chain */}
            <NotificationChain riskLevel={riskLevel} />
          </div>
          
        </div>
      )}
    </div>
  );
};
