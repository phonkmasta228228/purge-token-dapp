'use client';

import React, { FC, useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Connection, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('6K6md8GFmT8fncNbWqHSJrduYfG6HgnFCp34jdouGVSM');
const PURGE_MINT = new PublicKey('6To4f6r9X3WFsLwWLFdj7ju8BNquzZwupVHUc8oS5pgP');
const X1_RPC = 'https://rpc.mainnet.x1.xyz';

// 38 PDAs from the old program that have reward>0 (claimed) but claimed byte=0.
// These are permanently claimed and must never appear as claimable in the UI.
const LEGACY_CLAIMED_PDAS = new Set([
  "5JuLXqMM248aJv4Mxqtg2Pnpp48tRvbSz5Hy9qvrZ2YW",
  "H9ZFH7vpYfJ2BHj7cECFV2oi6kveBLZYMkbGoaA4pe3a",
  "HrxNHjCgJsTmYL4cfpKXYUjiqPCcPrTwesidVUPcRzh9",
  "6iz4h72LWyPPJpvV1iiT9nUdP624kab9wf4eyXcCzxFa",
  "6i9TM4AhA9HdVBW843FJ9pAQKG6yKBrLP1u3Fg9dwUCc",
  "2KEx8nL3NaDUBmp8NyHwX42bDWqoQbbmHhchc5cH1dt6",
  "8FJ2y1Cei1WNiVfU9dAjrExBR44rMpHc42nNqVeizGED",
  "FSjueC1mYyGqX1rGMybSGsEZDEgx1CNB1exvb3tncac6",
  "GZTCUJPGWChmRG7ZHEGXk4rYMiqGxnvHiZzgGsxUreQE",
  "QU9tGW2968zZW54oZt3KDJGf4vtjKhNQjJzS2EnkLc9",
  "EDmagKkZZmdBAKdkGwNe4TjLw72HCHQ4KtruXCGjBeMA",
  "8aqdr9RXGZV2cggr4eajZHtATdQC3S4cPCKcq6LfXVJT",
  "2SG9qD8KCH6JBzTaMjpofABiUjafepKqZx3PKUypZKin",
  "7QJBMMiWcQ8yUbV7wWR9MT2TC5qoeLabFcRAR6vUnoyk",
  "3GhHydmM8LH3N1G31GZLaArSrbUFsSHToLcYogRPaQC7",
  "Bc1SeomSSZpVVTnV3SAv7TL4MPUtgbckyxFSM5zRZuJg",
  "BWVNUUoCDX7d6DRW4BPKtY16URrXA37o4WBCxcVedxS9",
  "Gt74RN7PLSSPZQBjRv4aC9LqT6YeQHkMPBryn2RLGJ8r",
  "42Qvd4Yy74oqZzEyR89q9qx8rFPQYTTaQT97aoRvnnqi",
  "4DNrfi7E1h2xQeqHM3HhYPCxQASrJc3aSoxQfTpFCVyx",
  "5Pi9iSEDJNABoaymv9rw83NPk5uJBahwvxpvFwXAEM5S",
  "8ZLoPux84BVsQQVWmDecMEHQEYZPehVYRB94cbwPVxfD",
  "C9UWmYh8XmRRCpHxN1Gnauvke3KvbMH2ZAo6GHotQfN",
  "J3wTxNk3FeiDDKH1hntYHD4hqdST9oT7euLznQ9APTto",
  "BBgXCSrykqj4YN5MmK8dbBrTS1tFFUsFA5qgd5CJyN22",
  "4dVqFg6JDEC7bA7x9kVDQy8zNdUp4ooRcPyFWKLX1d7q",
  "G59VoD4wQPJyPQJGq89HGMn1thjS9qW9hgt3R16pUWMT",
  "B6BbQkyXiBYQDa3dFsiSRy2Ndi5L1bkPus6AKUvH1D1Y",
  "CR4nRWFegG9KiPkW64rNnLfkE7hLUbbqJtnoKADWenN8",
  "5LQH7FzewUaPs3ThbQDXSnPYmTXKT4oLWF2CxQT2eMG6",
  "B2zz2LNrd8TxRviTWyV7B2Fe3h5VNPw8bSQKCEGV2FBE",
  "4RcNgyaAfdWT9BrzwYmMMmfjsC6nC4GtkN92mxK52JpT",
  "DFkuZxjZ1AU1UzeTSPDkFatvwyTyXhVotpDWyG55UpgL",
  "5aG2xfh6nr8UEkMniDqu6GwwSH2oU3tSpmtgizd35mqw",
  "k4ErQufResXFbxbZPxQjWFjy1exioG6Ttva18ERfeYf",
  "CckUn98bkmqDZgBPhnq8FQ1i1ozYtxJk6mVjvr2WTLhk",
  "XZGm33fide4ghCAGdWTkZD6usq1eEHQ1VUp3qeiUSs6",
  "14LJ5rfaTj6e46Uo6dSZCTvhcGNqGhsm3cCXGhyczTMv",
]);

interface UserMintData {
  slotId: number;
  owner: string;
  cRank: bigint;
  amp: bigint;
  reward: bigint;
  termDays: bigint;
  maturityTs: bigint;
  active: boolean;
}

interface CounterData {
  totalMinted: number;
  activeCount: number;
  nextSlot: number;
}

function getUserCounterPDA(userPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_counter'), userPubkey.toBuffer()],
    PROGRAM_ID
  );
}

function getUserMintPDA(userPubkey: PublicKey, slotId: number): [PublicKey, number] {
  const slotBuf = Buffer.alloc(4);
  slotBuf.writeUInt32LE(slotId, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('user_mint'), userPubkey.toBuffer(), slotBuf],
    PROGRAM_ID
  );
}

function parseCounter(data: Buffer): CounterData {
  // Two possible layouts depending on program version:
  // v1 (17 bytes): 8 disc | 4 next_slot (u32) | 4 active_count (u32) | 1 bump
  // v2 (41 bytes): 8 disc | 32 owner | 8 total_minted (u64) | 1 active_count | 1 next_slot | 1 bump
  if (data.length <= 17) {
    // v1 layout
    let offset = 8;
    const nextSlot = data.readUInt32LE(offset); offset += 4;
    const activeCount = data.readUInt32LE(offset);
    return { totalMinted: nextSlot, activeCount, nextSlot };
  } else {
    // v2 layout
    let offset = 8 + 32; // skip discriminator + owner pubkey
    const totalMinted = Number(data.readBigUInt64LE(offset)); offset += 8;
    const activeCount = data[offset]; offset += 1;
    const nextSlot = data[offset];
    return { totalMinted, activeCount, nextSlot };
  }
}

function parseUserMint(data: Buffer, slotId: number): UserMintData {
  // UserMint layout: 8 disc | 32 owner | 4 slot_index (u32) | 8 term_days (u64) |
  //                  8 mature_ts (i64) | 8 rank (u64) | 8 amp (u64) | 8 reward (u64) | 1 claimed | 1 bump
  //
  // Two generations of the program exist on-chain:
  //   Old program: sets reward field to the minted amount after claiming (claimed byte stays 0)
  //   New program: sets claimed byte to 1 after claiming (reward field stays 0)
  // A slot is claimed if EITHER condition is true.
  let offset = 8;
  const owner = new PublicKey(data.slice(offset, offset + 32)).toBase58(); offset += 32;
  const parsedSlotId = data.readUInt32LE(offset); offset += 4;
  const termDays = data.readBigUInt64LE(offset); offset += 8;
  const maturityTs = BigInt(data.readBigInt64LE(offset)); offset += 8;
  const cRank = data.readBigUInt64LE(offset); offset += 8;
  const amp = data.readBigUInt64LE(offset); offset += 8;
  const reward = data.readBigUInt64LE(offset); offset += 8;
  const claimedByte = data[offset] !== 0; // new program sets this to 1
  const claimedByReward = reward > 0n;    // old program wrote minted amount here instead
  const active = !claimedByte && !claimedByReward;
  return { slotId: parsedSlotId, owner, cRank, amp, reward, termDays, maturityTs, active };
}

function formatPurge(amount: number): string {
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(2) + 'M';
  if (amount >= 1_000) return (amount / 1_000).toFixed(1) + 'K';
  return amount.toLocaleString();
}

function getCountdown(maturityTs: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (maturityTs <= now) return 'Ready to claim';
  const diff = Number(maturityTs - now);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.ceil((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}H REMAINING`;
  return `${Math.max(1, minutes)}M REMAINING`;
}

// Anchor discriminator for claim_mint_reward (computed from Rust source)
// SHA-256("global:claim_mint_reward")[0..8] = 3f191054743316de
const CLAIM_MINT_REWARD_DISCRIMINATOR = new Uint8Array([0x3f, 0x19, 0x10, 0x54, 0x74, 0x33, 0x16, 0xde]);
const INITIAL_AMP = 69n; // program caps amp at this value (in real AMP units)

function estimateReward(mint: UserMintData): number {
  // amp is stored as amp_real << 8 (e.g. AMP 68 stored as 17408)
  // On-chain formula: min(amp_real, INITIAL_AMP) × term_days
  const ampReal = mint.amp >> 8n;
  const amp = ampReal > INITIAL_AMP ? INITIAL_AMP : ampReal;
  return Number(amp * mint.termDays); // whole PURGE tokens
}

function estimateRewardDisplay(mint: UserMintData): number {
  return estimateReward(mint); // already in whole PURGE
}

function encodeU32LE(val: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, val, true);
  return buf;
}



export const ClaimRewards: FC = () => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const [counter, setCounter] = useState<CounterData | null>(null);
  const [mints, setMints] = useState<UserMintData[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<number | null>(null); // slot being claimed
  const [claimingAll, setClaimingAll] = useState(false);
  const [autoRepeat, setAutoRepeat] = useState(false);
  const [claimAllResults, setClaimAllResults] = useState<{ sigs: string[]; failed: number[] } | null>(null);
  const [txSigs, setTxSigs] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});

  const loadData = useCallback(async (pubkey: PublicKey) => {
    setLoading(true);
    try {
      const conn = new Connection(X1_RPC, 'confirmed');

      // Load counter first
      const [counterPDA] = getUserCounterPDA(pubkey);
      const counterInfo = await conn.getAccountInfo(counterPDA);
      if (!counterInfo || counterInfo.data.length < 17) {
        setCounter(null);
        setMints([]);
        return;
      }

      const counterData = parseCounter(counterInfo.data as Buffer);
      setCounter(counterData);

      if (counterData.nextSlot === 0) {
        setMints([]);
        return;
      }

      // Derive all PDAs upfront, then use getMultipleAccountsInfo in batches of 100
      // to avoid hammering the RPC with thousands of parallel requests
      const slotRange = Array.from({ length: counterData.nextSlot }, (_, i) => i);
      const pdas = slotRange.map(slotId => getUserMintPDA(pubkey, slotId)[0]);

      const BATCH_SIZE = 100;
      const activeMints: UserMintData[] = [];
      for (let i = 0; i < pdas.length; i += BATCH_SIZE) {
        const batchPdas = pdas.slice(i, i + BATCH_SIZE);
        const batchSlots = slotRange.slice(i, i + BATCH_SIZE);
        try {
          const infos = await conn.getMultipleAccountsInfo(batchPdas, 'confirmed');
          for (let j = 0; j < infos.length; j++) {
            const info = infos[j];
            if (!info || info.data.length < 86) continue;
            if (LEGACY_CLAIMED_PDAS.has(batchPdas[j].toBase58())) continue;
            const mint = parseUserMint(info.data as Buffer, batchSlots[j]);
            if (mint.active) activeMints.push(mint);
          }
        } catch {
          // batch failed — skip it
        }
      }

      // Smart sort: claimable now → maturing soonest → claimed
      const nowTs = BigInt(Math.floor(Date.now() / 1000));
      activeMints.sort((a, b) => {
        const aMature = nowTs >= a.maturityTs;
        const bMature = nowTs >= b.maturityTs;
        if (aMature !== bMature) return aMature ? -1 : 1; // claimable first
        return Number(a.maturityTs - b.maturityTs); // soonest maturity first within group
      });
      setMints(activeMints);
    } catch {
      setCounter(null);
      setMints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!publicKey) {
      setCounter(null);
      setMints([]);
      return;
    }
    loadData(publicKey);
  }, [publicKey, loadData]);

  const handleClaimReward = useCallback(async (mint: UserMintData) => {
    if (!publicKey || !sendTransaction) return;
    const slotId = mint.slotId;
    setClaiming(slotId);
    setErrors(prev => { const n = { ...prev }; delete n[slotId]; return n; });
    setTxSigs(prev => { const n = { ...prev }; delete n[slotId]; return n; });

    try {
      const conn = new Connection(X1_RPC, 'confirmed');
      const [userMintPDA] = getUserMintPDA(publicKey, slotId);
      const [counterPDA] = getUserCounterPDA(publicKey);
      const [globalStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('global_state')], PROGRAM_ID
      );
      const [mintAuthorityPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('mint_authority')], PROGRAM_ID
      );

      const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
      // Program was compiled with non-standard ASSOCIATED_TOKEN_PROGRAM_ID — must match exactly
      const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
      const userTokenAccount = await getAssociatedTokenAddress(PURGE_MINT, publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

      // Anchor discriminator for claim_mint_reward (hardcoded: 3f191054743316de)
      const slotBuf = encodeU32LE(slotId);
      const ixData = Buffer.from(new Uint8Array([...CLAIM_MINT_REWARD_DISCRIMINATOR, ...slotBuf]));

      const { blockhash } = await conn.getLatestBlockhash('confirmed');
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      // Create ATA if it doesn't exist
      const ataInfo = await conn.getAccountInfo(userTokenAccount);
      if (!ataInfo) {
        tx.add(createAssociatedTokenAccountInstruction(
          publicKey, userTokenAccount, publicKey, PURGE_MINT,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
        ));
      }

      // Account order must match Anchor's ClaimMintReward struct:
      // user_counter, user_mint, global_state, mint, mint_authority,
      // user_token_account, user, system_program, token_program, associated_token_program
      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: counterPDA,                    isSigner: false, isWritable: true  },
          { pubkey: userMintPDA,                   isSigner: false, isWritable: true  },
          { pubkey: globalStatePDA,                isSigner: false, isWritable: true  },
          { pubkey: PURGE_MINT,                    isSigner: false, isWritable: true  },
          { pubkey: mintAuthorityPDA,              isSigner: false, isWritable: false },
          { pubkey: userTokenAccount,              isSigner: false, isWritable: true  },
          { pubkey: publicKey,                     isSigner: true,  isWritable: true  },
          { pubkey: SystemProgram.programId,       isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID,              isSigner: false, isWritable: false },
          { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,   isSigner: false, isWritable: false },
        ],
        data: ixData,
      });
      tx.add(ix);

      const sig = await sendTransaction(tx, conn, { skipPreflight: false, preflightCommitment: 'confirmed' });
      await conn.confirmTransaction(sig, 'confirmed');
      setMints(prev => prev.filter(m => m.slotId !== slotId));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      let friendly = msg;
      if (msg.includes('NotMature') || msg.includes('MaturityNotReached')) {
        friendly = 'Not yet mature — come back when your term expires.';
      } else if (msg.includes('NoActiveRank')) {
        friendly = 'No active mint found for this slot.';
      }
      setErrors(prev => ({ ...prev, [slotId]: friendly }));
    } finally {
      setClaiming(null);
    }
  }, [publicKey, sendTransaction, loadData]);

  // isUserDenial detects wallet rejection vs on-chain errors
  const isUserDenial = (e: unknown): boolean => {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    return msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected the request');
  };

  // claimOneBatch claims up to `limit` mature mints in one button press.
  // Returns { sigs, failed, denied } where denied=true means user rejected a tx.
  const claimOneBatch = useCallback(async (limit: number): Promise<{ sigs: string[]; failed: number[]; denied: boolean }> => {
    if (!publicKey || !sendTransaction) return { sigs: [], failed: [], denied: false };
    const candidateMints = mints
      .filter(m => BigInt(Math.floor(Date.now() / 1000)) >= m.maturityTs)
      .slice(0, limit);
    if (candidateMints.length === 0) return { sigs: [], failed: [], denied: false };

    const conn = new Connection(X1_RPC, 'confirmed');
    const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } = await import('@solana/spl-token');
    const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
    const userTokenAccount = await getAssociatedTokenAddress(PURGE_MINT, publicKey, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
    const [counterPDA] = getUserCounterPDA(publicKey);
    const [globalStatePDA] = PublicKey.findProgramAddressSync([Buffer.from('global_state')], PROGRAM_ID);
    const [mintAuthorityPDA] = PublicKey.findProgramAddressSync([Buffer.from('mint_authority')], PROGRAM_ID);

    // Re-verify on-chain claimed status before batching
    const verifiedResults = await Promise.allSettled(
      candidateMints.map(async (mint) => {
        const [mintPDA] = getUserMintPDA(publicKey, mint.slotId);
        const info = await conn.getAccountInfo(mintPDA);
        if (!info || info.data.length < 86) return null;
        const parsed = parseUserMint(info.data as Buffer, mint.slotId);
        return parsed.active ? mint : null;
      })
    );
    const matureMints = verifiedResults
      .filter((r): r is PromiseFulfilledResult<UserMintData | null> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value as UserMintData);

    if (matureMints.length === 0) return { sigs: [], failed: [], denied: false };

    const ataInfo = await conn.getAccountInfo(userTokenAccount);
    const needsAta = !ataInfo;

    const BATCH_SIZE = 5;
    const batches: UserMintData[][] = [];
    for (let i = 0; i < matureMints.length; i += BATCH_SIZE) {
      batches.push(matureMints.slice(i, i + BATCH_SIZE));
    }

    const sigs: string[] = [];
    const failed: number[] = [];

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];
      try {
        const { blockhash } = await conn.getLatestBlockhash('confirmed');
        const tx = new Transaction();
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        if (bi === 0 && needsAta) {
          tx.add(createAssociatedTokenAccountInstruction(
            publicKey, userTokenAccount, publicKey, PURGE_MINT,
            TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
          ));
        }

        for (const mint of batch) {
          const [userMintPDA] = getUserMintPDA(publicKey, mint.slotId);
          const slotBuf = encodeU32LE(mint.slotId);
          const ixData = Buffer.from(new Uint8Array([...CLAIM_MINT_REWARD_DISCRIMINATOR, ...slotBuf]));
          tx.add(new TransactionInstruction({
            programId: PROGRAM_ID,
            keys: [
              { pubkey: counterPDA,                  isSigner: false, isWritable: true  },
              { pubkey: userMintPDA,                 isSigner: false, isWritable: true  },
              { pubkey: globalStatePDA,              isSigner: false, isWritable: true  },
              { pubkey: PURGE_MINT,                  isSigner: false, isWritable: true  },
              { pubkey: mintAuthorityPDA,            isSigner: false, isWritable: false },
              { pubkey: userTokenAccount,            isSigner: false, isWritable: true  },
              { pubkey: publicKey,                   isSigner: true,  isWritable: true  },
              { pubkey: SystemProgram.programId,     isSigner: false, isWritable: false },
              { pubkey: TOKEN_PROGRAM_ID,            isSigner: false, isWritable: false },
              { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            data: ixData,
          }));
        }

        const sig = await sendTransaction(tx, conn, { skipPreflight: false, preflightCommitment: 'confirmed' });
        await conn.confirmTransaction(sig, 'confirmed');
        sigs.push(sig);
      } catch (batchErr) {
        // If user denied the wallet popup, stop immediately
        if (isUserDenial(batchErr)) {
          return { sigs, failed, denied: true };
        }
        // Batch failed for on-chain reason — retry each slot individually
        for (const mint of batch) {
          try {
            const { blockhash: bh } = await conn.getLatestBlockhash('confirmed');
            const soloTx = new Transaction();
            soloTx.recentBlockhash = bh;
            soloTx.feePayer = publicKey;
            const [userMintPDA] = getUserMintPDA(publicKey, mint.slotId);
            const slotBuf = encodeU32LE(mint.slotId);
            const ixData = Buffer.from(new Uint8Array([...CLAIM_MINT_REWARD_DISCRIMINATOR, ...slotBuf]));
            soloTx.add(new TransactionInstruction({
              programId: PROGRAM_ID,
              keys: [
                { pubkey: counterPDA,                  isSigner: false, isWritable: true  },
                { pubkey: userMintPDA,                 isSigner: false, isWritable: true  },
                { pubkey: globalStatePDA,              isSigner: false, isWritable: true  },
                { pubkey: PURGE_MINT,                  isSigner: false, isWritable: true  },
                { pubkey: mintAuthorityPDA,            isSigner: false, isWritable: false },
                { pubkey: userTokenAccount,            isSigner: false, isWritable: true  },
                { pubkey: publicKey,                   isSigner: true,  isWritable: true  },
                { pubkey: SystemProgram.programId,     isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID,            isSigner: false, isWritable: false },
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
              ],
              data: ixData,
            }));
            const soloSig = await sendTransaction(soloTx, conn, { skipPreflight: false, preflightCommitment: 'confirmed' });
            await conn.confirmTransaction(soloSig, 'confirmed');
            sigs.push(soloSig);
          } catch (soloErr) {
            if (isUserDenial(soloErr)) {
              return { sigs, failed, denied: true };
            }
            failed.push(mint.slotId);
          }
        }
      }
    }

    return { sigs, failed, denied: false };
  }, [publicKey, sendTransaction, mints]);

  const handleClaimAll = useCallback(async () => {
    if (!publicKey || !sendTransaction) return;
    const SINGLE_BATCH_LIMIT = 5;

    setClaimingAll(true);
    setClaimAllResults(null);

    try {
      let allSigs: string[] = [];
      let allFailed: number[] = [];

      const { sigs, failed, denied } = await claimOneBatch(SINGLE_BATCH_LIMIT);
      allSigs = sigs;
      allFailed = failed;

      // If user denied, kill auto-repeat immediately — set the ref synchronously
      // so any already-scheduled setTimeout callback sees it before state update lands
      if (denied) {
        autoRepeatRef.current = false;
        setAutoRepeat(false);
        setClaimAllResults({ sigs: allSigs, failed: allFailed });
        await loadData(publicKey);
        return;
      }

      await loadData(publicKey);
      setClaimAllResults({ sigs: allSigs, failed: allFailed });
    } finally {
      setClaimingAll(false);
    }
  }, [publicKey, sendTransaction, mints, loadData, claimOneBatch]);

  // Auto-repeat: after each batch finishes (claimingAll goes false), fire the next one
  // if auto-repeat is still enabled and there are more mature mints waiting.
  // autoRepeatRef is the single source of truth for auto-repeat logic.
  // It is set synchronously by: checkbox onChange, and denial in handleClaimAll.
  // Never sync it from the autoRepeat state — that lags behind by one render.
  const autoRepeatRef = React.useRef(false);

  // Keep a stable ref to handleClaimAll so the effect never needs it as a dep
  const handleClaimAllRef = React.useRef(handleClaimAll);
  useEffect(() => { handleClaimAllRef.current = handleClaimAll; }, [handleClaimAll]);

  // Only re-arm on claimingAll true → false transition
  const prevClaimingAllRef = React.useRef(false);
  useEffect(() => {
    const wasRunning = prevClaimingAllRef.current;
    prevClaimingAllRef.current = claimingAll;

    if (!wasRunning || claimingAll) return;   // only on true→false
    if (!autoRepeatRef.current) return;        // auto-repeat was killed
    if (!publicKey) return;

    const timer = setTimeout(() => {
      if (autoRepeatRef.current) handleClaimAllRef.current();
    }, 1000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimingAll, publicKey]); // intentionally exclude handleClaimAll — using ref

  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">🎯</div>
        <h2 className="text-xl font-black text-[#00FFAA] tracking-widest mb-2">CLAIM REWARDS</h2>
        <p className="text-[#555] mb-6 text-sm">Connect your wallet to view your active mints</p>
        <WalletMultiButton />
      </div>
    );
  }

  const now = BigInt(Math.floor(Date.now() / 1000));

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[#00FFAA] tracking-widest mb-1">CLAIM REWARDS</h1>
        <p className="text-[#555] text-sm">Your active mints and claimable PURGE.</p>
      </div>

      {/* Counter summary */}
      {counter !== null && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="bg-[#111] border border-[#1a1a1a] rounded p-3 text-center">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Active</div>
            <div className="text-xl font-black text-[#00FFAA]">{counter.activeCount}</div>
          </div>
          <div className="bg-[#111] border border-[#1a1a1a] rounded p-3 text-center">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Future Claims</div>
            <div className="text-xl font-black text-white">
              {formatPurge(mints
                .filter(m => m.active && BigInt(Math.floor(Date.now() / 1000)) < m.maturityTs)
                .reduce((sum, m) => sum + (estimateRewardDisplay(m)), 0))}
            </div>
            <div className="text-xs text-[#444] mt-1">PURGE pending</div>
          </div>
          <div className="bg-[#111] border border-[#1a1a1a] rounded p-3 text-center">
            <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Matured</div>
            <div className="text-xl font-black text-[#00FFAA]">
              {formatPurge(mints
                .filter(m => m.active && BigInt(Math.floor(Date.now() / 1000)) >= m.maturityTs)
                .reduce((sum, m) => sum + (estimateRewardDisplay(m)), 0))}
            </div>
            <div className="text-xs text-[#444] mt-1">PURGE ready</div>
          </div>
        </div>
      )}

      {/* Batch Claim button — only shown when mature mints exist */}
      {!loading && mints.filter(m => BigInt(Math.floor(Date.now() / 1000)) >= m.maturityTs).length > 1 && (
        <div className="mb-6 space-y-3">
          <button
            onClick={handleClaimAll}
            disabled={claimingAll || claiming !== null}
            className="w-full py-4 bg-[#00FFAA] text-black font-black text-sm tracking-widest rounded
              hover:bg-[#00cc88] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase"
          >
            {claimingAll ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full"></span>
                Claiming...
              </span>
            ) : `🎯 Batch Claim (next 5)`}
          </button>

          {/* Auto-repeat toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={autoRepeat}
              onChange={e => { autoRepeatRef.current = e.target.checked; setAutoRepeat(e.target.checked); }}
              disabled={claimingAll || claiming !== null}
              className="w-4 h-4 accent-[#00FFAA] cursor-pointer"
            />
            <span className="text-xs text-[#888] uppercase tracking-widest">
              Auto-repeat{autoRepeat ? ' — will stop on denied tx' : ''}
            </span>
          </label>

          {claimAllResults && (
            <div className="mt-1 space-y-2">
              {claimAllResults.sigs.map((sig, i) => (
                <div key={sig} className="bg-[#001a0d] border border-[#00FFAA33] rounded p-3 text-xs space-y-1">
                  <div className="text-[#00FFAA] font-bold">✓ Batch {i + 1} claimed</div>
                  <a href={`https://explorer.mainnet.x1.xyz/tx/${sig}`} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-[#00FFAA] break-all hover:underline">{sig}</a>
                </div>
              ))}
              {claimAllResults.failed.length > 0 && (
                <div className="bg-[#1a0000] border border-[#ff000033] rounded p-3 text-xs text-[#ff6666]">
                  ⚠ Failed slots: {claimAllResults.failed.join(', ')} — try claiming individually
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="text-center py-16 text-[#555] text-sm animate-pulse">Loading on-chain data...</div>
      )}

      {!loading && (counter === null || mints.length === 0) && (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-8 text-center">
          <div className="text-[#555] mb-2">No active mints found</div>
          <div className="text-xs text-[#444]">Go to the Mint tab to claim a rank first.</div>
        </div>
      )}

      {/* Mint cards grid */}
      {!loading && mints.length > 0 && (
        <div className="space-y-3">
          {mints.map((mint) => {
            const isMature = now >= mint.maturityTs;
            const maturityDate = new Date(Number(mint.maturityTs) * 1000);
            const isClaiming = claiming === mint.slotId;
            const sig = txSigs[mint.slotId];
            const err = errors[mint.slotId];

            return (
              <div
                key={mint.slotId}
                className={`bg-[#111] border rounded-lg p-5 ${
                  isMature ? 'border-[#00FFAA33]' : 'border-[#1a1a1a]'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-xs text-[#555] uppercase tracking-widest mb-1">Slot #{mint.slotId}</div>
                    <div className="text-lg font-black text-white">Rank #{mint.cRank.toString()}</div>
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-widest ${
                    isMature
                      ? 'bg-[#001a0d] text-[#00FFAA] border border-[#00FFAA33]'
                      : 'bg-[#1a1000] text-yellow-400 border border-yellow-800'
                  }`}>
                    {isMature ? '✓ Mature' : getCountdown(mint.maturityTs)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm mb-4">
                  <div>
                    <div className="text-xs text-[#555] mb-1">Term</div>
                    <div className="font-mono text-[#888]">{mint.termDays.toString()} days</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#555] mb-1">Matures</div>
                    <div className="font-mono text-[#888]">
                      {maturityDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#555] mb-1">PURGE</div>
                    <div className={`font-mono font-bold ${isMature ? 'text-[#00FFAA]' : 'text-[#888]'}`}>
                      {formatPurge(estimateRewardDisplay(mint))}
                    </div>
                  </div>
                </div>

                {isMature && !sig && (
                  <button
                    onClick={() => handleClaimReward(mint)}
                    disabled={isClaiming || claiming !== null}
                    className="w-full py-3 bg-[#00FFAA] text-black font-black text-sm tracking-widest rounded
                      hover:bg-[#00cc88] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                  >
                    {isClaiming ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full"></span>
                        Claiming...
                      </span>
                    ) : '🎯 Claim PURGE Reward'}
                  </button>
                )}

                {!isMature && (
                  <div className="w-full py-3 bg-[#0d0d0d] border border-[#1a1a1a] text-[#555] text-xs tracking-widest rounded text-center uppercase">
                    ⏳ {getCountdown(mint.maturityTs)}
                  </div>
                )}

                {sig && (
                  <div className="bg-[#001a0d] border border-[#00FFAA33] rounded p-3 text-xs space-y-1">
                    <div className="text-[#00FFAA] font-bold">✓ PURGE Claimed!</div>
                    <a href={`https://explorer.mainnet.x1.xyz/tx/${sig}`} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-[#00FFAA] break-all hover:underline">{sig}</a>
                  </div>
                )}

                {err && (
                  <div className="bg-[#1a0000] border border-[#ff000033] rounded p-3 text-xs text-[#ff6666]">
                    ⚠ {err}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
