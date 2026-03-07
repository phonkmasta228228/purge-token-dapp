'use client';

import { useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { PURGE_IDL, PurgeIdl, UserMintAccount } from '@/lib/idl';
import { PURGE_PROGRAM_ID, GLOBAL_STATE_SEED, USER_MINT_SEED } from '@/lib/constants';

export interface ClaimRankResult {
  signature: string;
  rank: number;
  maturityDate: Date;
  termDays: number;
}

export interface UseClaimRankReturn {
  claimRank: (termDays: number) => Promise<ClaimRankResult>;
  claiming: boolean;
  error: string | null;
  success: ClaimRankResult | null;
  reset: () => void;
}

export function useClaimRank(): UseClaimRankReturn {
  const { publicKey, sendTransaction, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ClaimRankResult | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const getProgram = useCallback(() => {
    if (!publicKey || !signTransaction) throw new Error('Wallet not connected');
    const provider = new AnchorProvider(
      connection,
      { publicKey, signTransaction, sendTransaction } as any,
      { commitment: 'confirmed' }
    );
    return new Program<PurgeIdl>(PURGE_IDL, PURGE_PROGRAM_ID, provider);
  }, [connection, publicKey, signTransaction, sendTransaction]);

  const claimRank = useCallback(
    async (termDays: number): Promise<ClaimRankResult> => {
      if (!publicKey || !connected) {
        throw new Error('Wallet not connected');
      }
      if (termDays < 1 || termDays > 500) {
        throw new Error('Term must be between 1 and 500 days');
      }

      setClaiming(true);
      setError(null);
      setSuccess(null);

      try {
        const program = getProgram();

        // Get PDA addresses
        const [globalState] = web3.PublicKey.findProgramAddressSync(
          [Buffer.from(GLOBAL_STATE_SEED)],
          PURGE_PROGRAM_ID
        );

        const [userMint] = web3.PublicKey.findProgramAddressSync(
          [Buffer.from(USER_MINT_SEED), publicKey.toBuffer()],
          PURGE_PROGRAM_ID
        );

        // Build the transaction
        const tx = await program.methods
          .claimRank(new BN(termDays))
          .accounts({
            userMint,
            globalState,
            user: publicKey,
            systemProgram: web3.SystemProgram.programId,
          })
          .transaction();

        // Get latest blockhash
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        // Send transaction
        const signature = await sendTransaction(tx, connection);

        // Wait for confirmation
        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed'
        );

        // Fetch the user mint account to get the assigned rank
        const userMintAccount = await program.account.UserMint.fetch(userMint) as unknown as UserMintAccount;
        const maturityDate = new Date(userMintAccount.matureTs.toNumber() * 1000);
        const rank = userMintAccount.rank.toNumber();

        const result: ClaimRankResult = {
          signature,
          rank,
          maturityDate,
          termDays,
        };

        setSuccess(result);
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Claim rank failed';
        setError(message);
        throw err;
      } finally {
        setClaiming(false);
      }
    },
    [publicKey, connected, connection, sendTransaction, getProgram]
  );

  return { claimRank, claiming, error, success, reset };
}
