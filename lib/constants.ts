import { PublicKey } from '@solana/web3.js';

export const X1_RPC_URL =
  process.env.NEXT_PUBLIC_X1_RPC_URL || 'https://rpc.mainnet.x1.xyz';

export const PURGE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || '8g6XCgTdm5WnQmFRZYu4DMUCJyKU1JWxKmQ16KqweP2n'
);

export const PURGE_TOKEN_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_TOKEN_MINT || 'CYrMpw3kX92ZtGbLF9p7nQSYt7mj1J1WvDidtt5rpCyP'
);

export const PURGE_MINT_AUTHORITY = new PublicKey(
  process.env.NEXT_PUBLIC_MINT_AUTHORITY || 'CQHziQSbKjuoVyEcqaDjxD2NNYcLD3fBX2vA6VD1FV4p'
);

export const PURGE_DECIMALS = 18;

export const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);

export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1brs'
);

// Seeds for PDA derivation
export const GLOBAL_STATE_SEED = 'global_state';
export const USER_MINT_SEED = 'user_mint';
export const MINT_AUTHORITY_SEED = 'mint_authority';

// XEN-style constants
export const MIN_TERM_DAYS = 1;
export const MAX_TERM_DAYS = 500;
