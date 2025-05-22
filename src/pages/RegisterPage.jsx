import React, { useState, useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { BrowserProvider, formatEther, Contract } from "ethers";
import contractAbi from "../contract-abi.json";
import { getSponsorFromUrlOrDefault } from "../utils";

const CONTRACT_ADDRESS = import.meta.env.VITE_MAIN_CONTRACT_ADDRESS;
const DEPLOYER_WALLET = import.meta.env.VITE_DEPLOYER_WALLET;

export default function RegisterPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const [sponsor, setSponsor] = useState("");
  const [rankPrice, setRankPrice] = useState("-");
  const [maticPrice, setMaticPrice] = useState("-");
  const [error, setError] = useState("");
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isConnected && window.ethereum === undefined) {
      const wc = connectors.find(c => c.id === "walletConnect");
      if (wc) connect({ connector: wc });
    }
  }, [connectors, connect, isConnected]);

  useEffect(() => {
    setSponsor(getSponsorFromUrlOrDefault(DEPLOYER_WALLET));
  }, []);

  useEffect(() => {
    async function fetchPrices() {
      try {
        const provider = new ethers.providers.JsonRpcProvider(import.meta.env.VITE_POLYGON_RPC_URL);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, provider);
        const rankInfo = await contract.getRankInfo(1);
        setRankPrice(formatEther(rankInfo.price) + " MATIC");
        fetch("https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd")
          .then(r => r.json())
          .then(data => setMaticPrice("$" + data["matic-network"]?.usd))
          .catch(() => setMaticPrice("-"));
      } catch {
        setRankPrice("-");
        setMaticPrice("-");
      }
    }
    fetchPrices();
  }, []);

  const handleRegister = async () => {
    setError("");
    setSuccess("");
    setRegistering(true);
    try {
      let provider;
      if (window.ethereum) {
        provider = new BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
      } else {
        setError("No wallet provider found. Please use MetaMask or WalletConnect.");
        setRegistering(false);
        return;
      }
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractAbi, signer);
      const rankInfo = await contract.getRankInfo(1);
      const price = rankInfo.price;
      const tx = await contract.register(sponsor, { value: price });
      await tx.wait();
      setSuccess("Registration and Rank 1 purchase successful! Redirecting to Dashboard...");
      setTimeout(() => window.location.href = "/dashboard", 1000);
      setTimeout(() => window.location.href = "/dashboard", 2000);
    } catch (e) {
      setError(e?.reason || e?.message || "Registration failed.");
    }
    setRegistering(false);
  };

  return (
    <div className="container">
      <div className="logo">"Linea — Network"</div>
      <div className="card" id="registrationCard">
        <h2 className="card-title">Register & Purchase Rank 1</h2>
        <p className="card-text">
          To access the dashboard, you must register and purchase Rank 1 (Bronze).
        </p>
        <div className="wallet-info" id="walletAddress">
          {isConnected ? address : "Wallet not connected"}
        </div>
        <div className="price-info">
          <div>Rank 1 (Bronze) Price:</div>
          <div className="price-value" id="rankPrice">{rankPrice}</div>
          <div>
            MATIC Price: <span id="maticPrice">{maticPrice}</span>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="sponsorAddress" className="form-label">
            Sponsor Address
          </label>
          <input
            type="text"
            id="sponsorAddress"
            className="form-control"
            placeholder="Enter sponsor wallet address"
            value={sponsor}
            onChange={e => setSponsor(e.target.value)}
            disabled
          />
        </div>
        {!isConnected && (
          <button className="btn" onClick={() => {
            if (window.ethereum) {
              connect({ connector: connectors.find(c => c.id === "injected") });
            } else {
              connect({ connector: connectors.find(c => c.id === "walletConnect") });
            }
          }}>
            Connect Wallet
          </button>
        )}
        <button
          className="btn"
          onClick={handleRegister}
          disabled={!isConnected || registering}
        >
          {registering ? "Registering..." : "Register & Purchase Rank 1"}
        </button>
        <div className="error-message">{error}</div>
        <div className="success-message">{success}</div>
      </div>
    </div>
  );
}