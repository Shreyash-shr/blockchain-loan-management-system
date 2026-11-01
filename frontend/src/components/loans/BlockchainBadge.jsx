import React, { useState } from 'react';
import { ShieldCheck, Copy, Check, ExternalLink, Cpu } from 'lucide-react';

export default function BlockchainBadge({
  txHash,
  contractAddress,
  network = 'Polygon Amoy Testnet (ChainID: 80002)',
  status = 'confirmed',
  className = '',
  compact = false,
}) {
  const [copied, setCopied] = useState(false);

  if (!txHash) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded-lg">
        <Cpu size={12} className="text-slate-400" />
        Off-chain only
      </span>
    );
  }

  const shortHash = `${txHash.slice(0, 6)}...${txHash.slice(-4)}`;
  const shortContract = contractAddress ? `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}` : null;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border ${
        status === 'confirmed'
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-amber-50 text-amber-800 border-amber-200'
      } ${className}`}>
        <ShieldCheck size={13} className={status === 'confirmed' ? 'text-emerald-600' : 'text-amber-600'} />
        <span>{shortHash}</span>
        <button
          onClick={handleCopy}
          title="Copy full transaction hash"
          className="hover:opacity-75 focus:outline-none ml-0.5"
        >
          {copied ? <Check size={11} className="text-emerald-700" /> : <Copy size={11} />}
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 p-3.5 space-y-2 text-xs ${className}`}>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-bold text-emerald-900 uppercase tracking-wider text-[11px]">
          <ShieldCheck size={15} className="text-emerald-600" />
          Blockchain Verified Audit Trail
        </span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 uppercase">
          {status}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 pt-1">
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Tx Hash</span>
          <div className="flex items-center gap-1 mt-0.5 font-mono text-[11px] text-slate-800">
            <span>{shortHash}</span>
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-emerald-100 rounded text-emerald-700 transition"
              title="Copy Transaction Hash"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        {shortContract && (
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Smart Contract</span>
            <div className="flex items-center gap-1 mt-0.5 font-mono text-[11px] text-slate-800">
              <span>{shortContract}</span>
            </div>
          </div>
        )}
      </div>

      <div className="text-[10px] text-slate-500 pt-1 border-t border-emerald-100/60 flex items-center justify-between">
        <span>Network: <strong className="text-slate-700 font-medium">{network}</strong></span>
        <span className="text-slate-400">Stored in PostgreSQL</span>
      </div>
    </div>
  );
}

