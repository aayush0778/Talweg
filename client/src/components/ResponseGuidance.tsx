import React, { useState } from 'react';
import { ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
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
      <div className="bg-ink-950/80 border border-line-strong rounded-lg p-4 mb-4">
        <div className="text-paper-400 flex items-center justify-between">
          <h3 className="font-mono text-xs font-semibold text-paper-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-paper-400" aria-hidden="true" />
            <span>RESPONSE GUIDANCE</span>
          </h3>
          <span className="text-xs font-mono text-paper-400">Risk level unavailable</span>
        </div>
      </div>
    );
  }

  const guidance = getResponseGuidance(riskLevel, zoneName);
  const isSevere = riskLevel === 'SEVERE';
  const isHigh = riskLevel === 'HIGH';

  const tierAccent = isSevere
    ? 'border-l-4 border-l-risk-severe'
    : isHigh
    ? 'border-l-4 border-l-risk-high'
    : 'border-l-4 border-l-lichen-500';

  return (
    <div
      className={`bg-ink-950/80 border border-line-strong rounded-lg overflow-hidden mb-4 transition-all ${tierAccent}`}
    >
      {/* Header (Always visible) */}
      <div
        className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-ink-900/70 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <div className="flex items-center gap-2.5">
          <ShieldAlert
            className={`w-4 h-4 ${isSevere ? 'text-risk-severe animate-pulse' : 'text-lichen-400'}`}
            aria-hidden="true"
          />
          <h3 className="text-xs font-mono font-semibold text-paper-100 uppercase tracking-wider">
            Operational Protocol
          </h3>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${guidance.urgencyColor}`}>
            {guidance.urgencyLevel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-paper-400">
            ETA: <span className="text-paper-200 font-semibold">{guidance.estimatedResponseTime}</span>
          </span>
          <button
            type="button"
            className="text-paper-400 hover:text-paper-100 transition-colors p-0.5"
            aria-label={isExpanded ? 'Collapse guidance' : 'Expand guidance'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-4 border-t border-line-subtle bg-ink-900/40 space-y-4">
          <div>
            <h4 className="text-[10px] font-mono font-semibold text-paper-400 uppercase tracking-wider mb-2.5">
              Required Interventions
            </h4>
            <ul className="space-y-2">
              {guidance.actions.map((item, index) => (
                <li key={index} className="flex items-start gap-2.5 text-xs text-paper-200">
                  <span className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded bg-ink-800 border border-line-subtle text-paper-300 font-mono text-[10px] mt-0.5">
                    {index + 1}
                  </span>
                  <span className={item.priority === 'emergency' ? 'text-risk-severe font-medium' : ''}>
                    {item.action}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-[10px] font-mono font-semibold text-paper-400 uppercase tracking-wider mb-2">
                Emergency Contacts
              </h4>
              <div className="space-y-1.5">
                {guidance.contacts.map((contact, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center text-xs bg-ink-950/70 p-2 rounded border border-line-subtle"
                  >
                    <span className="text-paper-200">{contact.role}</span>
                    <span className="text-paper-400 text-[10px] font-mono px-1.5 py-0.5 bg-ink-800 rounded">
                      {contact.method}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-mono font-semibold text-paper-400 uppercase tracking-wider mb-2">
                Public Advisory
              </h4>
              <div
                className={`p-2.5 rounded border text-xs leading-relaxed ${
                  isSevere
                    ? 'bg-risk-severe/10 border-risk-severe/40 text-risk-severe'
                    : 'bg-ink-950/70 border-line-subtle text-paper-300'
                }`}
              >
                {guidance.populationNote}
              </div>
            </div>
          </div>

          {/* Stakeholder Notification Escalation Chain */}
          <NotificationChain riskLevel={riskLevel} />
        </div>
      )}
    </div>
  );
};
