import "../styles/index.css";
import React, { useEffect, useState } from "react";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { useAccount, useConnect } from "wagmi";
import { ethers, BrowserProvider, isAddress } from "ethers";
import contractABI from "../contract-abi.json";
import { useNavigate } from "react-router-dom";

const CONTRACT_ADDRESS = import.meta.env.VITE_MAIN_CONTRACT_ADDRESS;
const DEPLOYER_WALLET = import.meta.env.VITE_DEPLOYER_WALLET;

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

{isMobile && (
  <div style={{
    background:'#FFD700',
    color:'#222',
    padding:'10px 14px',
    textAlign:'center',
    fontWeight:'bold',
    borderRadius:'10px',
    margin:'12px 0'
  }}>
    For the best wallet experience, open this DApp in your crypto wallet’s built-in browser (Trust Wallet, SafePal, MetaMask Mobile, etc).
  </div>
)}


export default function IndexPage() {
  const { open } = useWeb3Modal();
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [regError, setRegError] = useState("");

  useEffect(() => {
    async function autoRegisterIfNeeded() {
      if (!isConnected || !address) return;
      setLoading(true);
      setRegError("");

      try {
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);

        const isRegistered = await contract.isUserRegistered(address);

        if (isRegistered) {
          // User is already registered, redirect to dashboard
          navigate("/dashboard");
          return;
        }

        // Get sponsor address from ?ref=... or fallback to deployer wallet
        const params = new URLSearchParams(window.location.search);
        let sponsor = params.get("ref");
        if (!sponsor || !isAddress(sponsor) || sponsor.toLowerCase() === address.toLowerCase()) {
          sponsor = DEPLOYER_WALLET;
        }

        // Get Rank 1 price
        const rankInfo = await contract.getRankInfo(1);
        const price = rankInfo.price;

        // Call register
        const tx = await contract.register(sponsor, { value: price });
        await tx.wait();

        // Success: redirect to dashboard
        navigate("/dashboard");
      } catch (err) {
        // Show friendly error
        setRegError("Registration failed. Please try again or check your wallet balance.");
        console.error("Registration error:", err);
      }
      setLoading(false);
    }
    autoRegisterIfNeeded();
  }, [isConnected, address, navigate]);

  // Button: if no wallet installed
  function walletInstallInfo() {
    if (typeof window.ethereum === "undefined") {
      return (
        <div style={{ marginTop: 16, color: "#e8c874", fontWeight: 500 }}>
          No wallet detected. Please{" "}
          <a
            href="https://metamask.io/download.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#d4af37", textDecoration: "underline" }}
          >
            install MetaMask
          </a>{" "}
          or another compatible wallet to continue.
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
        <button
          className="btn"
          onClick={open}
          disabled={loading}
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
