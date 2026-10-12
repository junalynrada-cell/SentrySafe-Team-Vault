'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Copy,
  Check,
  EyeOff,
  Database,
  Lock,
  Clock,
  Terminal,
} from 'lucide-react';

interface RevealModalProps {
  isOpen: boolean;
  onClose: () => void;
  secretName: string;
  plaintext: string;
  resourceType?: string;
  credentialBreakdown?: {
    host: string;
    port: string;
    database: string;
    username: string;
    password: string;
  };
}

export const RevealModal: React.FC<RevealModalProps> = ({
  isOpen,
  onClose,
  secretName,
  plaintext,
  credentialBreakdown,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [autoMaskSeconds, setAutoMaskSeconds] = useState(30);

  // Auto-mask countdown timer
  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setAutoMaskSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      setAutoMaskSeconds(30);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, fieldName = 'full') => {
    navigator.clipboard.writeText(text);
    if (fieldName === 'full') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {secretName}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold">
                  DECRYPTED
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                AES-256-GCM hardware decryption verified against active grant.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Auto-masking alert timer */}
          <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Zero-Trust Auto-Mask Security Timer Active</span>
            </div>
            <span className="font-mono font-bold bg-emerald-950/90 px-2.5 py-1 rounded border border-emerald-800/50">
              Auto-mask in {autoMaskSeconds}s
            </span>
          </div>

          {/* Decrypted Plaintext Block */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-indigo-400" />
                Plaintext Connection String / Secret
              </span>
              <button
                onClick={() => copyToClipboard(plaintext, 'full')}
                className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied Full String</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Full Value</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-xs text-emerald-400 break-all leading-relaxed select-all">
              {plaintext}
            </div>
          </div>

          {/* Structured Credential Breakdown (if Database resource) */}
          {credentialBreakdown && (
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-blue-400" />
                <span>Credential Breakdown Parameters</span>
              </div>

              <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl divide-y divide-zinc-800/60 text-xs">
                {Object.entries(credentialBreakdown).map(([key, val]) => (
                  <div
                    key={key}
                    className="p-3 flex items-center justify-between gap-4 hover:bg-zinc-900/40 transition-colors"
                  >
                    <span className="font-mono text-zinc-500 uppercase text-[10px] w-24">
                      {key}
                    </span>
                    <span className="font-mono text-zinc-200 flex-1 truncate select-all">
                      {val}
                    </span>
                    <button
                      onClick={() => copyToClipboard(val, key)}
                      className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors"
                      title={`Copy ${key}`}
                    >
                      {copiedField === key ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Logging Notice */}
          <div className="p-3.5 bg-zinc-950 border border-zinc-800/80 rounded-xl text-[11px] text-zinc-400 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-zinc-300 font-medium">Compliance Audit Logged:</span>{' '}
              This secret reveal operation has been appended to the immutable PostgreSQL audit log with your user identity, timestamp, and IP address.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between">
          <span className="text-[11px] font-mono text-zinc-500">
            Zero-Trust Ephemeral Plaintext
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Mask & Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
