'use client';

import { useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { PURGE_IDL, PurgeIdl, UserMintAccount } from '@/lib/idl';
import { 
  PURGE_PROGRAM_ID, 
  PURGE_TOKEN_MINT,
  GLOBAL_STATE_SEED, 
  USER_MINT_SEED,
  MINT_AUTHORITY_SEED 
} from '@/lib/constants';

export interface ClaimRewardResult {
  signature: string;
  amount: string;
  rank: number;
  termDays: number;
}

export interface UseClaimRewardReturn {
  claimReward: () => Promise<ClaimRewardResult>;
  claiming: boolean;
  error: string | null;
  success: ClaimRewardResult | null;
  reset: () => void;
}

export function useClaimReward(): UseClaimRewardReturn {
  const { publicKey, sendTransaction, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ClaimRewardResult | null>(null);

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

  const claimReward = useCallback(
    async (): Promise<ClaimRewardResult> => {
      if (!publicKey || !connected) {
        throw new Error('Wallet not connected');
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

        const [mintAuthority] = web3.PublicKey.findProgramAddressSync(
          [Buffer.from(MINT_AUTHORITY_SEED)],
          PURGE_PROGRAM_ID
        );

        // Get user's token account
        const userTokenAccount = await getAssociatedTokenAddress(
          PURGE_TOKEN_MINT,
          publicKey
        );

        // Fetch user mint info before claiming (for the response)
        const userMintAccount = await program.account.UserMint.fetch(userMint) as unknown as UserMintAccount;
        const rank = userMintAccount.rank.toNumber();
        const termDays = userMintAccount.termDays.toNumber();

        // Build the transaction
        const tx = await program.methods
          .claimMintReward()
          .accounts({
            userMint,
            globalState,
            mint: PURGE_TOKEN_MINT,
            mintAuthority,
            userTokenAccount,
            user: publicKey,
            systemProgram: web3.SystemProgram.programId,
            tokenProgram: new web3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
            associatedTokenProgram: new web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1brs'),
            rent: web3.SYSVAR_RENT_PUBKEY,
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

        // Fetch the user mint account again to get the reward amount
        const updatedUserMint = await program.account.UserMint.fetch(userMint) as unknown as UserMintAccount;
        const rawAmount = updatedUserMint.rewardAmount.toNumber();
        // Format with 18 decimals
        const formattedAmount = (rawAmount / 10**18).toLocaleString(undefined, { 
          maximumFractionDigits: 6 
        });

        const result: ClaimRewardResult = {
          signature,
          amount: formattedAmount,
          rank,
          termDays,
        };

        setSuccess(result);
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Claim reward failed';
        setError(message);
        throw err;
      } finally {
        setClaiming(false);
      }
    },
    [publicKey, connected, connection, sendTransaction, getProgram]
  );

  return { claimReward, claiming, error, success, reset };
}
