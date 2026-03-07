export const PURGE_IDL = {
  version: "1.0.0",
  name: "purge",
  instructions: [
    {
      name: "initialize",
      accounts: [
        { name: "globalState", isMut: true, isSigner: false },
        { name: "mint", isMut: true, isSigner: false },
        { name: "mintAuthority", isMut: false, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false }
      ],
      args: []
    },
    {
      name: "claimRank",
      accounts: [
        { name: "userMint", isMut: true, isSigner: false },
        { name: "globalState", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false }
      ],
      args: [{ name: "termDays", type: "u64" }]
    },
    {
      name: "claimMintReward",
      accounts: [
        { name: "userMint", isMut: true, isSigner: false },
        { name: "globalState", isMut: true, isSigner: false },
        { name: "mint", isMut: true, isSigner: false },
        { name: "mintAuthority", isMut: false, isSigner: false },
        { name: "userTokenAccount", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "associatedTokenProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false }
      ],
      args: []
    }
  ],
  accounts: [
    {
      name: "GlobalState",
      type: {
        kind: "struct",
        fields: [
          { name: "totalMinters", type: "u64" },
          { name: "totalXBurnt", type: "u64" },
          { name: "activeMints", type: "u64" },
          { name: "genesisTs", type: "i64" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "UserMint",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "publicKey" },
          { name: "termDays", type: "u64" },
          { name: "matureTs", type: "i64" },
          { name: "claimed", type: "bool" },
          { name: "rank", type: "u64" },
          { name: "rewardAmount", type: "u64" },
          { name: "bump", type: "u8" }
        ]
      }
    }
  ],
  errors: [
    { code: 6000, name: "InvalidTerm", msg: "Invalid term length. Must be between 1 and 500 days." },
    { code: 6001, name: "ActiveMintExists", msg: "Active mint exists. Wait for maturity or claim existing reward." },
    { code: 6002, name: "AlreadyClaimed", msg: "Reward already claimed." },
    { code: 6003, name: "NotMature", msg: "Mint has not matured yet." }
  ],
  metadata: {
    address: "8g6XCgTdm5WnQmFRZYu4DMUCJyKU1JWxKmQ16KqweP2n"
  }
};

// Use any type for IDL to avoid anchor type issues
export type PurgeIdl = any;

// Account data types
export interface UserMintAccount {
  owner: { toString(): string };
  termDays: { toNumber(): number };
  matureTs: { toNumber(): number };
  claimed: boolean;
  rank: { toNumber(): number };
  rewardAmount: { toNumber(): number };
  bump: number;
}

export interface GlobalStateAccount {
  totalMinters: { toNumber(): number };
  totalXBurnt: { toNumber(): number };
  activeMints: { toNumber(): number };
  genesisTs: { toNumber(): number };
  bump: number;
}
