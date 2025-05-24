
import "../styles/App.css";
import React, { useEffect, useState } from "react";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { useAccount } from "wagmi";
import { ethers, isAddress } from "ethers";
import contractABI from "../contract-abi.json";
import { useNavigate } from "react-router-dom";
import { getProvider } from "../utils/provider";

const CONTRACT_ADDRESS = import.meta.env.VITE_MAIN_CONTRACT_ADDRESS;
const DEPLOYER_WALLET = import.meta.env.VITE_DEPLOYER_WALLET;

const POLYGON_RPC_ENDPOINTS = [
  'https://polygon-rpc.com',
  'https://rpc-mainnet.maticvigil.com',
  'https://rpc.ankr.com/polygon',
  'https://polygon-bor.publicnode.com'
];

export default function IndexPage() {
  const { open } = useWeb3Modal();
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [regError, setRegError] = useState("");

  // Auto open WalletConnect modal on mobile browsers
  useEffect(() => {
    if (isConnected) return;
    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandaloneDApp = window.ethereum && (
      window.ethereum.isMetaMask || window.ethereum.isTrust || window.ethereum.isTokenPocket || window.ethereum.isSafePal
    );
    if (isMobile && !isStandaloneDApp) {
      setTimeout(() => {
        open && open();
      }, 600);
    }
  }, [open, isConnected]);

  const handleConnectWallet = () => {
    open();
  };

  useEffect(() => {
    async function autoRegisterIfNeeded() {
      if (!isConnected || !address) return;
      setLoading(true);
      setRegError("");
      try {
        let provider;
        for (const endpoint of POLYGON_RPC_ENDPOINTS) {
          try {
            provider = getProvider(endpoint);
            if (!window.ethereum) await provider.getBlockNumber();
            break;
          } catch (e) { continue; }
        }
        if (!provider) throw new Error("All Polygon RPC endpoints failed");

        const signer = window.ethereum
          ? await provider.getSigner()
          : null;

        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer || provider);

        const isRegistered = await contract.isUserRegistered(address);
        if (isRegistered) {
          navigate("/dashboard");
          return;
        }

        const params = new URLSearchParams(window.location.search);
        let sponsor = params.get("ref");
        if (!sponsor || !isAddress(sponsor) || sponsor.toLowerCase() === address.toLowerCase()) {
          sponsor = DEPLOYER_WALLET;
        }
        const rankInfo = await contract.getRankInfo(1);
        const price = rankInfo.price;

        const tx = await contract.register(sponsor, { value: price });
        await tx.wait();
        navigate("/dashboard");
      } catch (err) {
        setRegError("Registration failed. Please try again, check your chain and your wallet balance!");
      }
      setLoading(false);
    }
    autoRegisterIfNeeded();
  }, [isConnected, address, navigate]);

  function walletInstallInfo() {
    if (typeof window.ethereum === "undefined") {
      return (
        <div style={{ marginTop: 16, color: "#e8c874", fontWeight: 500 }}>
          No wallet detected. Please{" "}
          <a href="https://metamask.io/download.html" target="_blank" rel="noopener noreferrer"
            style={{ color: "#d4af37", textDecoration: "underline" }}>
            install MetaMask
          </a> or another compatible wallet to continue.
        </div>
      );
    }
    return null;
  }

  return (
    <div className="container" style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div className="logo" style={{ fontFamily: "'Playfair Display',serif", color: "#d4af37", fontWeight: 700, fontSize: "2.3rem", textAlign: "center", marginBottom: 32 }}>
        Linea — Decentralizing Wealth
      </div>
      <div className="card" style={{
        padding: "34px 28px 32px 28px",
        background: "rgba(10,31,68,0.89)",
        border: "1.5px solid #d4af3740",
        borderRadius: 22,
        boxShadow: "0 8px 32px #0a1f4452",
        marginBottom: 24,
        textAlign: "center"
      }}>
        <h2 style={{ color: "#d4af37", fontWeight: 600, fontSize: 28, marginBottom: 18 }}>Start Building Wealth</h2>
        <p style={{ color: "#fff", marginBottom: 32, fontSize: 16, fontWeight: 400 }}>
          Connect your wallet and get started. <br />
          <span style={{ color: "#e8c874" }}>Your sponsor will be assigned automatically from your referral link or the default sponsor.</span>
        </p>
        <button className="btn" onClick={handleConnectWallet} disabled={loading}
          style={{
            width: "100%",
            padding: "13px 0",
            fontSize: "1.12rem",
            fontWeight: 600,
            borderRadius: 30,
            background: "linear-gradient(135deg, #d4af37, #50c878)",
            color: "#0a1f44",
            opacity: loading ? 0.72 : 1,
            cursor: loading ? "not-allowed" : "pointer"
          }}>
          {loading ? "Processing..." : "Connect Wallet"}
        </button>
        {regError && (
          <div style={{ color: "#f76", marginTop: 16, fontWeight: 500, fontSize: 15 }}>
            {regError}
          </div>
        )}
        {walletInstallInfo()}
      </div>
      <div style={{ textAlign: "center", color: "#d4af37", fontWeight: 500, marginTop: 28, fontSize: 14 }}>
        Smart Contract powered by Linea • Secure & Transparent
      </div>
    </div>
  );
}
