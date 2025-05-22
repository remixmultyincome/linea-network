import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import IndexPage from "./pages/IndexPage";
import { useAccount } from "wagmi";
import { JsonRpcProvider, Contract } from "ethers";
import contractAbi from "./contract-abi.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_MAIN_CONTRACT_ADDRESS;

function RedirectController() {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function checkRegistration() {
      if (!isConnected || !address) return;
      try {
        const provider = new JsonRpcProvider(import.meta.env.VITE_POLYGON_RPC_URL);
        const contract = new Contract(CONTRACT_ADDRESS, contractAbi, provider);
        const isReg = await contract.isUserRegistered(address);
        if (isReg) navigate("/dashboard");
        else navigate("/");
      } catch {
        navigate("/");
      }
      setChecked(true);
    }
    checkRegistration();
  }, [isConnected, address, navigate]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <RedirectController />
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
}