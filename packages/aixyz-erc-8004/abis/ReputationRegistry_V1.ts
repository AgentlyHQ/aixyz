/**
 * ReputationRegistry V1 ABI
 * Old format with `score` (uint8) instead of `value` (int256) + `valueDecimals` (uint8)
 */
export const ReputationRegistryAbi_V1 = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "target",
        type: "address",
      },
    ],
    name: "AddressEmptyCode",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "implementation",
        type: "address",
      },
    ],
    name: "ERC1967InvalidImplementation",
    type: "error",
  },
  {
    inputs: [],
    name: "ERC1967NonPayable",
    type: "error",
  },
  {
    inputs: [],
    name: "FailedCall",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidInitialization",
    type: "error",
  },
  {
    inputs: [],
    name: "NotInitializing",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    inputs: [],
    name: "UUPSUnauthorizedCallContext",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "slot",
        type: "bytes32",
      },
    ],
    name: "UUPSUnsupportedProxiableUUID",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "agentId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "clientAddress",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint64",
        name: "feedbackIndex",
        type: "uint64",
      },
    ],
    name: "FeedbackRevoked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint64",
        name: "version",
        type: "uint64",
      },
    ],
    name: "Initialized",
    type: "event",
  },
  // V1 NewFeedback event with `score` (uint8) instead of `value`/`valueDecimals`
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "agentId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "clientAddress",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "feedbackIndex",
        type: "uint64",
      },
      {
        indexed: false,
        internalType: "uint8",
        name: "score", // OLD FORMAT: score (uint8) instead of value (int256) + valueDecimals (uint8)
        type: "uint8",
      },
      {
        indexed: true,
        internalType: "string",
        name: "indexedTag1",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "tag1",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "tag2",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "endpoint",
        type: "string",
      },
      {
        indexed: false,
        internalType: "string",
        name: "feedbackURI",
        type: "string",
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "feedbackHash",
        type: "bytes32",
      },
    ],
    name: "NewFeedback",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "agentId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "clientAddress",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint64",
        name: "feedbackIndex",
        type: "uint64",
      },
      {
        indexed: true,
        internalType: "address",
        name: "responder",
        type: "address",
      },
      {
        indexed: false,
        internalType: "string",
        name: "responseURI",
        type: "string",
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "responseHash",
        type: "bytes32",
      },
    ],
    name: "ResponseAppended",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "implementation",
        type: "address",
      },
    ],
    name: "Upgraded",
    type: "event",
  },
] as const;
