import React from "react";
import ReactDOM from "react-dom/client";
import { WagmiConfig, createConfig, http } from "wagmi";
import { polygon } from "wagmi/chains";
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./App.css";

const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID;

const config = createConfig({
  chains: [polygon],
  transports: {
    [polygon.id]: http(),
  },
  ssr: false,
});

createWeb3Modal({
  wagmiConfig: config,
  projectId,
  chains: [polygon],
  enableOnNonInjectedDevices: true,
});

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={config}>
        <App />
      </WagmiConfig>
    </QueryClientProvider>
  </React.StrictMode>
);
