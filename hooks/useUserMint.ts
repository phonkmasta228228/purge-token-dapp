'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, web3 } from '@coral-xyz/anchor';
import { PURGE_IDL, PurgeIdl, UserMintAccount, GlobalStateAccount } from '@/lib/idl';
import { PURGE_PROGRAM_ID, GLOBAL_STATE_SEED, USER_MINT_SEED } from '@/lib/constants';

export interface UserMintData {
  owner: string;
  termDays: number;
  matureTs: number;
  claimed: boolean;
  rank: number;
  rewardAmount: string;
  bump: number;
  isMature: boolean;
  timeRemaining: number; // seconds
  maturityDate: Date;
}

export interface GlobalStateData {
  totalMinters: number;
  totalXBurnt: number;
  activeMints: number;
  genesisTs: number;
}

export interface UseUserMintReturn {
  userMint: UserMintData | null;
  globalState: GlobalStateData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserMint(): UseUserMintReturn {
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [userMint, setUserMint] = useState<UserMintData | null>(null);
  const [globalState, setGlobalState] = useState<GlobalStateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!publicKey) {
      setUserMint(null);
      setGlobalState(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = new AnchorProvider(
        connection,
        { publicKey, signTransaction, sendTransaction } as any,
        { commitment: 'confirmed' }
      );
      const program = new Program<PurgeIdl>(PURGE_IDL, PURGE_PROGRAM_ID, provider);

      // Get PDA addresses
      const [globalStatePda] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from(GLOBAL_STATE_SEED)],
        PURGE_PROGRAM_ID
      );

      const [userMintPda] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from(USER_MINT_SEED), publicKey.toBuffer()],
        PURGE_PROGRAM_ID
      );

      // Fetch global state
      try {
        const globalStateAccount = await program.account.GlobalState.fetch(globalStatePda) as unknown as GlobalStateAccount;
        setGlobalState({
          totalMinters: globalStateAccount.totalMinters.toNumber(),
          totalXBurnt: globalStateAccount.totalXBurnt.toNumber(),
          activeMints: globalStateAccount.activeMints.toNumber(),
          genesisTs: globalStateAccount.genesisTs.toNumber(),
        });
      } catch {
        // Global state might not exist yet
        setGlobalState(null);
      }

      // Fetch user mint
      try {
        const userMintAccount = await program.account.UserMint.fetch(userMintPda) as unknown as UserMintAccount;
        const matureTs = userMintAccount.matureTs.toNumber();
        const now = Math.floor(Date.now() / 1000);
        const timeRemaining = Math.max(0, matureTs - now);
        const rewardRaw = userMintAccount.rewardAmount.toNumber();
        
        setUserMint({
          owner: userMintAccount.owner.toString(),
          termDays: userMintAccount.termDays.toNumber(),
          matureTs,
          claimed: userMintAccount.claimed,
          rank: userMintAccount.rank.toNumber(),
          rewardAmount: rewardRaw > 0 
            ? (rewardRaw / 10**18).toLocaleString(undefined, { maximumFractionDigits: 6 })
            : 'Pending',
          bump: userMintAccount.bump,
          isMature: now >= matureTs && !userMintAccount.claimed,
          timeRemaining,
          maturityDate: new Date(matureTs * 1000),
        });
      } catch {
        // User mint doesn't exist yet
        setUserMint(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection, signTransaction, sendTransaction]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { userMint, globalState, loading, error, refetch: fetchData };
}
