'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useMintToken } from '@/hooks/useMintToken';
import { PURGE_MINT_AUTHORITY } from '@/lib/constants';
import { ClientOnly } from './ClientOnly';

function AuthorityBadge({ hasMintAuthority }: { hasMintAuthority: boolean }) {
  if (hasMintAuthority) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm">
        <span className="w-2 h-2 bg-green-500 rounded-full" />
        <span className="text-green-700 font-medium">Mint authority detected</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
      <span className="w-2 h-2 bg-amber-500 rounded-full" />
      <span className="text-amber-700 font-medium">No mint authority — read only</span>
    </div>
  );
}

function TransactionLink({ signature }: { signature: string }) {
  const explorerUrl = `https://explorer.mainnet.x1.xyz/tx/${signature}`;
  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-600 hover:text-indigo-700 text-sm font-medium inline-flex items-center gap-1"
    >
      {signature.slice(0, 12)}...{signature.slice(-8)}
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

function MintInterfaceInner() {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { mintTokens, minting, error, success, reset, hasMintAuthority } = useMintToken();
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState('');

  const validateAmount = useCallback((value: string) => {
    if (!value) {
      setValidationError('');
      return;
    }
    const num = parseFloat(value);
    if (isNaN(num)) {
      setValidationError('Enter a valid number');
    } else if (num <= 0) {
      setValidationError('Amount must be greater than 0');
    } else if (num > 1_000_000_000) {
      setValidationError('Amount exceeds maximum per transaction');
    } else {
      setValidationError('');
    }
  }, []);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmount(val);
    validateAmount(val);
    if (success || error) reset();
  };

  const handleMint = async () => {
    if (!amount || validationError) return;
    try {
      await mintTokens(amount);
    } catch {
      // error is already set in hook
    }
  };

  const handlePreset = (value: string) => {
    setAmount(value);
    validateAmount(value);
    if (success || error) reset();
  };

  const canMint =
    connected && hasMintAuthority && amount && !validationError && !minting;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-slate-900 font-bold text-lg mb-1">
          Mint Tokens
        </h2>
        <p className="text-slate-500 text-sm">
          Create new $PURGE tokens and add them to the supply
        </p>
      </div>

      {/* Wallet / Authority Status */}
      {!connected ? (
        <div className="mb-6 p-6 border-2 border-dashed border-slate-200 rounded-xl text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm mb-4">
            Connect your wallet to mint tokens
          </p>
          <button
            onClick={() => setVisible(true)}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all"
          >
            Connect Wallet
          </button>
        </div>
      ) : (
        <div className="mb-6 space-y-3">
          <AuthorityBadge hasMintAuthority={hasMintAuthority} />
          {!hasMintAuthority && (
            <div className="text-xs text-slate-500 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-medium">Mint authority:</span>{' '}
              <span className="font-mono break-all">
                {PURGE_MINT_AUTHORITY.toBase58()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Mint Form */}
      <div className="space-y-4">
        {/* Amount Input */}
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-2">
            Amount to Mint
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0.00"
              min="0"
              step="any"
              disabled={!connected || !hasMintAuthority || minting}
              className={`w-full bg-white border rounded-lg px-4 py-3 font-mono text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-lg
                ${validationError
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
                  : connected && hasMintAuthority
                    ? 'border-slate-200 focus:border-indigo-500'
                    : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                }
              `}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
              PURGE
            </span>
          </div>
          {validationError && (
            <p className="mt-1.5 text-red-600 text-sm flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {validationError}
            </p>
          )}
        </div>

        {/* Preset amounts */}
        {connected && hasMintAuthority && (
          <div>
            <p className="text-slate-500 text-xs mb-2 font-medium">Quick amounts</p>
            <div className="flex gap-2 flex-wrap">
              {['100', '1000', '10000', '1000000'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePreset(preset)}
                  disabled={minting}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {Number(preset).toLocaleString()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mint Button */}
        <button
          onClick={handleMint}
          disabled={!canMint}
          className={`w-full py-3 font-semibold rounded-lg transition-all duration-200 
            ${canMint
              ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.99] shadow-sm'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          {minting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Minting...
            </span>
          ) : !connected ? (
            'Connect Wallet to Mint'
          ) : !hasMintAuthority ? (
            'No Mint Authority'
          ) : !amount ? (
            'Enter Amount'
          ) : validationError ? (
            'Fix Amount'
          ) : (
            'Mint Tokens'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-medium text-sm mb-1">
            Mint failed
          </p>
          <p className="text-red-600 text-xs break-all">
            {error}
          </p>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-green-700 font-semibold text-sm">
              Mint successful
            </p>
          </div>
          <p className="text-green-600 text-sm mb-2">
            Minted {Number(success.amount).toLocaleString()} PURGE
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Transaction:</span>
            <TransactionLink signature={success.signature} />
          </div>
        </div>
      )}

      {/* Info note */}
      <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-lg">
        <p className="text-slate-500 text-xs leading-relaxed">
          Minted tokens are sent to your connected wallet&apos;s associated token account. 
          Transaction requires network fees in XNT.
        </p>
      </div>
    </div>
  );
}

// Exported component with ClientOnly guard to prevent SSR wallet context errors
export function MintInterface() {
  return (
    <ClientOnly
      fallback={
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="mb-6">
            <h2 className="text-slate-900 font-bold text-lg mb-1">
              Mint Tokens
            </h2>
            <p className="text-slate-400 text-sm">Loading wallet...</p>
          </div>
          <div className="h-32 flex items-center justify-center">
            <span className="inline-block w-6 h-6 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <MintInterfaceInner />
    </ClientOnly>
  );
}
