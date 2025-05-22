/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAIN_CONTRACT_ADDRESS: string;
  readonly VITE_DEPLOYER_WALLET: string;
  readonly VITE_WALLET_CONNECT_PROJECT_ID: string;
  readonly VITE_POLYGONSCAN_API_KEY: string;
  readonly VITE_ALCHEMY_API_KEY: string;
  readonly VITE_INFURA_API_KEY: string;
  readonly VITE_DEFAULT_CHAIN_ID: string;
  readonly VITE_POLYGON_RPC_URL: string;
  readonly VITE_POLYGON_SCAN_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
