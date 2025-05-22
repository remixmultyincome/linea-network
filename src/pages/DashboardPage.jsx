import "../styles/index.css";
import "./dashboard.css";
import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { ethers, BrowserProvider } from 'ethers';
import contractABI from '../contract-abi.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_MAIN_CONTRACT_ADDRESS;
const POLYGONSCAN_API_KEY = "VFPV2DPHDG4QZVAIE3YI3Z88NYUSGG9T1C";

const rankNames = [
  "Not Registered", "Bronze", "Silver", "Gold", "Platinum", "Diamond",
  "Ruby", "Emerald", "Sapphire", "Elite", "Royal", "Legend", "Mythic"
];

// ---- POLYGONSCAN EVENT FETCH UTILS ----
async function fetchRecentEvents(contractAddress) {
  // Get latest block number
  const latestBlock = await fetch(
    `https://api.polygonscan.com/api?module=proxy&action=eth_blockNumber&apikey=${POLYGONSCAN_API_KEY}`
  ).then(res => res.json())
   .then(data => parseInt(data.result, 16));
  const fromBlock = Math.max(latestBlock - 10000, 0);

  // Event topics
  const eventTopics = [
    ethers.id("BonusEarned(address,address,uint256,string)"),
    ethers.id("Withdrawal(address,uint256)"),
    ethers.id("UserRegistered(address,address,uint256)"),
    ethers.id("RankUpgraded(address,uint256)")
  ];

  // Fetch logs from Polygonscan
  const logs = [];
  for (let topic of eventTopics) {
    const url = `https://api.polygonscan.com/api?module=logs&action=getLogs&fromBlock=${fromBlock}&toBlock=latest&address=${contractAddress}&topic0=${topic}&apikey=${POLYGONSCAN_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.result && Array.isArray(json.result)) logs.push(...json.result);
  }
  logs.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));
  return logs.slice(0, 15); // Return the latest 15 logs
}

async function getTxDate(blockNumber) {
  try {
    // Ensure blockNumber is decimal, convert if hex string
    const blockNo = typeof blockNumber === "string" && blockNumber.startsWith("0x")
      ? parseInt(blockNumber, 16)
      : Number(blockNumber);

    const url = `https://api.polygonscan.com/api?module=block&action=getblockreward&blockno=${blockNo}&apikey=${POLYGONSCAN_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status === "1" && json.result.timeStamp) {
      const ts = Number(json.result.timeStamp) * 1000;
      return new Date(ts).toLocaleString();
    }
    // Debug info if failed
    console.warn("No timestamp found for block", blockNo, json);
    return "Unknown Date";
  } catch (err) {
    console.error("Failed to fetch date for block", blockNumber, err);
    return "Unknown Date";
  }
}


async function fetchRecentActivity(setTransactions, contractABI, contractAddress) {
  const iface = new ethers.Interface(contractABI);
  const logs = await fetchRecentEvents(contractAddress);
  const events = await Promise.all(
    logs.map(async log => {
      let parsed, type = "-", amount = "-", date = "Unknown Date";
      try {
        parsed = iface.parseLog(log);
        type = parsed.name;
        if (parsed.name === "BonusEarned" || parsed.name === "Withdrawal") {
          amount = ethers.formatEther(parsed.args.amount) + " MATIC";
        } else {
          amount = "-";
        }
        date = await getTxDate(log.blockNumber);
      } catch {}
      return { type, amount, date, status: "Completed" };
    })
  );
  setTransactions(events);
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [walletInfo, setWalletInfo] = useState({});
  const [contractStats, setContractStats] = useState({});
  const [maticPrice, setMaticPrice] = useState(null);
  const [referralLink, setReferralLink] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showDownlines, setShowDownlines] = useState(false);
  const [downlines, setDownlines] = useState([]);
  const [directReferrals, setDirectReferrals] = useState([]);
  const [nextRankCost, setNextRankCost] = useState("0");

  // Helper to shorten addresses
  const shortAddr = addr => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "-";

  useEffect(() => {
    async function verifyAndLoad() {
      if (!isConnected || !address) {
        navigate('/');
        return;
      }
      try {
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);

        const isRegistered = await contract.isUserRegistered(address);
        if (!isRegistered) {
          navigate('/');
          return;
        }

        setReferralLink(`${window.location.origin}?ref=${address}`);
        await Promise.all([
          loadContractStats(contract),
          loadWalletInfo(contract),
          fetchMaticPrice(),
          fetchRecentActivity(setTransactions, contractABI, CONTRACT_ADDRESS),
          loadDirectReferrals(contract),
          loadNextRankCost(contract)
        ]);
        setLoading(false);
      } catch (err) {
        navigate('/');
      }
    }
    verifyAndLoad();
    // eslint-disable-next-line
  }, [isConnected, address]);

  async function loadNextRankCost(contract) {
    try {
      if (walletInfo.rank < 12) {
        const price = await contract.getUpgradeCost(address);
        setNextRankCost(ethers.formatEther(price));
      }
    } catch (err) {
      setNextRankCost("0");
    }
  }

  async function loadContractStats(contract) {
    try {
      const stats = await contract.getContractStats();
      const totalUsers = await contract.totalUsers();
      setContractStats({
        contractBalance: ethers.formatEther(stats.contractBalance),
        totalRanks: stats.totalRanks.toString(),
        totalUsers: totalUsers.toString()
      });
    } catch (err) {}
  }

  async function loadWalletInfo(contract) {
    try {
      const userInfo = await contract.getUserInfo(address);
      const totalBalance = parseFloat(ethers.formatEther(userInfo.bonusBalance)) +
        parseFloat(ethers.formatEther(userInfo.dividendBalance));
      setWalletInfo({
        rank: userInfo.rank.toString(),
        bonusBalance: ethers.formatEther(userInfo.bonusBalance),
        dividendBalance: ethers.formatEther(userInfo.dividendBalance),
        totalBalance: totalBalance.toFixed(4),
        totalSponsorBonus: ethers.formatEther(userInfo.totalSponsorBonus),
        totalTierBonus: ethers.formatEther(userInfo.totalTierBonus),
        totalGenerationBonus: ethers.formatEther(userInfo.totalGenerationBonus),
        totalDividendBonus: ethers.formatEther(userInfo.totalDividendBonus),
        totalBonus: ethers.formatEther(userInfo.totalBonus),
        referralCount: userInfo.referralCounts.toString()
      });
      // Refresh next rank cost if wallet info changes
      if (userInfo.rank < 12) {
        const price = await contract.getUpgradeCost(address);
        setNextRankCost(ethers.formatEther(price));
      }
    } catch (err) {}
  }

  async function fetchMaticPrice() {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=matic-network&vs_currencies=usd');
      const data = await res.json();
      setMaticPrice(data['matic-network'].usd);
    } catch (err) {}
  }

  async function loadDirectReferrals(contract) {
    try {
      let referrals = await contract.getReferrals(address);
      if (!Array.isArray(referrals)) referrals = [];
      setDirectReferrals(referrals.slice(0, 3));
    } catch (err) {}
  }

  // Button Handlers
  const handleWithdraw = async () => {
    setActionLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
      const tx = await contract.withdraw();
      await tx.wait();
      await loadWalletInfo(contract);
      alert("Withdrawal successful!");
    } catch (err) {
      alert("Withdrawal failed: " + (err.reason || err.message));
    }
    setActionLoading(false);
  };

  const handleUpgradeRank = async () => {
    setActionLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
      const price = await contract.getUpgradeCost(address);
      const tx = await contract.upgradeRank({ value: price });
      await tx.wait();
      await loadWalletInfo(contract);
      alert("Rank upgrade successful!");
    } catch (err) {
      alert("Rank upgrade failed: Check your wallet balance");
    }
    setActionLoading(false);
  };

  const handleViewNetwork = async () => {
    setShowDownlines(true);
    setDownlines([]);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
      const result = await contract.getPlacementLine(address, 15);
      setDownlines(Array.isArray(result) ? result : []);
    } catch (err) {
      setDownlines([]);
    }
  };

  function copyTextToClipboard(text) {
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = 0;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
      } catch (err) {}
      document.body.removeChild(textArea);
      return Promise.resolve();
    }
  }

  const handleCopyLink = () => {
    copyTextToClipboard(referralLink).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 1200);
    });
  };

  // Modal for downlines
  const DownlineModal = () => (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(10,31,68,0.85)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{
        background: "#12254b",
        border: "2px solid #d4af37",
        borderRadius: 18,
        padding: 32,
        minWidth: 330,
        boxShadow: "0 12px 36px #0a1f4470",
        color: "#fff",
        maxWidth: "90vw"
      }}>
        <h2 style={{ color: "#d4af37", marginBottom: 18, fontWeight: 700, fontSize: 22 }}>
          Downline Structure (First 15)
        </h2>
        {downlines.length === 0 ? (
          <div style={{ color: "#e8c874", marginBottom: 12 }}>No downlines found</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "9px 14px", marginBottom: 20 }}>
            {downlines.map((addr, idx) => (
              <div key={idx} style={{
                background: "#0a1f44",
                border: "1.5px solid #50c87877",
                borderRadius: 7,
                padding: "8px 14px",
                color: "#50c878",
                fontFamily: "monospace",
                fontSize: 15,
                letterSpacing: "1.5px"
              }}>
                {shortAddr(addr)}
              </div>
            ))}
          </div>
        )}
        <button
          className="btn"
          onClick={() => setShowDownlines(false)}
          style={{
            background: "linear-gradient(135deg, #d4af37, #e8c874)",
            color: "#0a1f44",
            borderRadius: 22,
            minWidth: 110,
            fontSize: 17
          }}>
          Close
        </button>
      </div>
    </div>
  );

  if (loading) return <div className="wallet-info">Loading Dashboard...</div>;

  return (
    <div className="container" style={{ maxWidth: 1200, margin: '32px auto', padding: 0 }}>
      {showDownlines && <DownlineModal />}
      <div className="logo" style={{ marginBottom: 0 }}>
        <span style={{ fontFamily: "'Playfair Display',serif", color: "#d4af37", fontWeight: 700, fontSize: '2rem' }}>
          Linea — Decentralizing Wealth
        </span>
      </div>
      <div style={{ color: "#50c878", fontWeight: 500, margin: "10px 0 22px 0", fontSize: "1rem" }}>
        <span>●</span> Connected to matic (ChainID: 137) &nbsp;&nbsp;
        <span style={{ color: '#d4af37', fontWeight: 400 }}>
          {address?.substring(0, 6) + "..." + address?.slice(-4)}
        </span>
        <span style={{ float: 'right', color: '#fff' }}>
          MATIC Price: ${maticPrice}
        </span>
      </div>

      {/* Card grid */}
      <div style={{
        display: "flex",
        gap: 18,
        marginBottom: 18,
        justifyContent: "center"
      }}>
        <div className="card" style={{ flex: 1, minWidth: 240, maxWidth: 370, textAlign: "center" }}>
          <div style={{ fontWeight: 600, color: "#fff", fontSize: "1rem", marginBottom: 4 }}>Contract Balance (MATIC)</div>
          <div style={{ fontWeight: 700, fontSize: "1.18rem" }}>{contractStats.contractBalance}</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 240, maxWidth: 370, textAlign: "center" }}>
          <div style={{ fontWeight: 600, color: "#fff", fontSize: "1rem", marginBottom: 4 }}>Total Users</div>
          <div style={{ fontWeight: 700, fontSize: "1.18rem" }}>{contractStats.totalUsers}</div>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 240, maxWidth: 370, textAlign: "center" }}>
          <div style={{ fontWeight: 600, color: "#fff", fontSize: "1rem", marginBottom: 4 }}>Total Ranks</div>
          <div style={{ fontWeight: 700, fontSize: "1.18rem" }}>{contractStats.totalRanks}</div>
        </div>
      </div>

      {/* Earnings, Rank, Rewards */}
      <div style={{
        display: "flex",
        gap: 18,
        marginBottom: 18,
        justifyContent: "center"
      }}>
        <div className="card" style={{ flex: 1, minWidth: 310, maxWidth: 430 }}>
          <div style={{ fontWeight: 600, color: "#fff", fontSize: "1rem", marginBottom: 2 }}>
            Your Earnings <span style={{ float: 'right', fontWeight: 400, fontSize: '0.95rem' }}>Total Balance</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: "1.24rem", color: "#fff", margin: "8px 0" }}>
            {walletInfo.totalBalance} MATIC
          </div>
          <div style={{ color: "#e8c874", fontSize: 15 }}>Bonus Balance: {walletInfo.bonusBalance} MATIC</div>
          <div style={{ color: "#e8c874", fontSize: 15, marginBottom: 12 }}>Dividend Balance: {walletInfo.dividendBalance} MATIC</div>
          <button className="btn"
            disabled={actionLoading}
            style={{
              width: '100%', margin: '8px 0 0 0', fontSize: '1rem', borderRadius: 30,
              background: "linear-gradient(135deg, #50c878, #e8c874)"
            }}
            onClick={handleWithdraw}>
            {actionLoading ? "Processing..." : "Withdraw Earnings"}
          </button>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 310, maxWidth: 430 }}>
          <div style={{ fontWeight: 600, color: "#fff", fontSize: "1rem", marginBottom: 2 }}>Your Rank</div>
          <div style={{ fontWeight: 700, fontSize: "1.24rem", color: "#d4af37", margin: "8px 0" }}>
            {rankNames[walletInfo.rank]}
          </div>
          <div style={{ color: "#fff", fontSize: 15, marginBottom: 4 }}>Rank {walletInfo.rank}</div>
          <div style={{ color: "#e8c874", fontSize: 14, marginBottom: 12 }}>
            {walletInfo.rank >= 12 ? "Maximum rank achieved" : `Next rank cost: ${nextRankCost} MATIC`}
          </div>
          <button className="btn"
            disabled={actionLoading || walletInfo.rank >= 12}
            style={{
              width: '100%',
              margin: '8px 0 0 0',
              fontSize: '1rem',
              borderRadius: 30,
              background: walletInfo.rank >= 12
                ? "#555555"
                : "linear-gradient(135deg, #d4af37, #e8c874)",
              cursor: walletInfo.rank >= 12 ? "not-allowed" : "pointer"
            }}
            onClick={handleUpgradeRank}>
            {walletInfo.rank >= 12 ? "Maximum Rank Achieved" : actionLoading ? "Processing..." : "Upgrade Rank"}
          </button>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 310, maxWidth: 430 }}>
          <div style={{ fontWeight: 600, color: "#fff", fontSize: "1rem", marginBottom: 2 }}>
            Your Total Rewards <span style={{ float: 'right', fontWeight: 400, fontSize: '0.95rem' }}>Your Referrals</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: "1.24rem", color: "#fff", margin: "8px 0" }}>
            {walletInfo.referralCount}
          </div>
          <div style={{ color: "#e8c874", fontSize: 15 }}>Referral Bonus: {walletInfo.totalSponsorBonus} MATIC</div>
          <div style={{ color: "#e8c874", fontSize: 15 }}>Tier Bonus: {walletInfo.totalTierBonus} MATIC</div>
          <div style={{ color: "#e8c874", fontSize: 15 }}>Generation Bonus: {walletInfo.totalGenerationBonus} MATIC</div>
          <div style={{ color: "#e8c874", fontSize: 15 }}>Dividend Bonus: {walletInfo.totalDividendBonus} MATIC</div>
          <div style={{ color: "#fff", fontSize: 15, marginTop: 4 }}>Total Bonus: {walletInfo.totalBonus} MATIC</div>
          <button className="btn"
            disabled={actionLoading}
            style={{
              width: '100%', margin: '12px 0 0 0', fontSize: '1rem', borderRadius: 30,
              background: "linear-gradient(135deg, #d4af37, #50c878)"
            }}
            onClick={handleViewNetwork}>
            View Network
          </button>
        </div>
      </div>

      {/* Referral Benefits */}
      <div className="card" style={{ marginBottom: 18, background: "#0a1f44e8", border: "1.5px solid #d4af3722" }}>
        <div style={{ color: "#d4af37", fontWeight: 700, fontSize: 20, marginBottom: 6 }}>
          Your Referral Benefits
        </div>
        <div style={{ color: "#fff", fontSize: 15, marginBottom: 7 }}>
          <b>💎 25% Instant Referral Bonus</b><br />
          <span style={{ color: "#e8c874" }}>Receive immediate rewards on every deposit made by your direct referrals</span>
        </div>
        <div style={{ color: "#fff", fontSize: 15, marginBottom: 7 }}>
          <b>📊 60% Tier Bonuses</b><br />
          <span style={{ color: "#e8c874" }}>Earn up to 60% from your single-line auto-placement team structure</span>
        </div>
        <div style={{ color: "#fff", fontSize: 15, marginBottom: 7 }}>
          <b>🌐 15% Unlimited Generation Rewards</b><br />
          <span style={{ color: "#e8c874" }}>Get bonuses from every level of your organization without limits</span>
        </div>
        <div style={{ color: "#fff", fontSize: 15, marginBottom: 7 }}>
          <b>💰 Passive Income Stream</b><br />
          <span style={{ color: "#e8c874" }}>Build lasting wealth from your entire team's ongoing activity</span>
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="text" readOnly value={referralLink} style={{
            flex: 1,
            background: "#0a1f44",
            border: "1px solid #d4af37",
            borderRadius: 8,
            color: "#50c878",
            padding: "6px 12px",
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontSize: 14,
            marginRight: 4
          }} />
          <button
            className="btn"
            style={{
              width: 36, minWidth: 36, height: 36, padding: 0, margin: 0,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#23283b",
              color: "#d4af37",
              border: "1.5px solid #d4af37",
              boxShadow: "0 1px 5px #0a1f4422"
            }}
            title="Copy Referral Link"
            onClick={handleCopyLink}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" style={{ verticalAlign: "middle" }}>
              <rect x="6" y="6" width="10" height="10" rx="2" fill={copySuccess ? "#50c878" : "#d4af37"} />
              <rect x="4" y="4" width="10" height="10" rx="2" fill="none" stroke={copySuccess ? "#50c878" : "#d4af37"} strokeWidth="2" />
            </svg>
          </button>
          {copySuccess && (
            <span style={{ marginLeft: 8, color: "#50c878", fontWeight: 500, fontSize: 14 }}>Copied!</span>
          )}
        </div>
      </div>

      {/* Direct Referrals */}
      <div className="card" style={{ marginBottom: 18, background: "#0a1f44e8", border: "1.5px solid #d4af3722", padding: 20 }}>
        <div style={{ color: "#d4af37", fontWeight: 700, fontSize: 20, marginBottom: 10 }}>
          Your Direct Referrals
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          {directReferrals.length === 0 ? (
            <div style={{ color: "#e8c874", fontSize: 15, flex: 1 }}>You have no direct referrals yet</div>
          ) : (
            directReferrals.slice(0, 10).map((addr, idx) => (
              <div key={idx} style={{
                flex: 1,
                background: "#12254b",
                border: "1.5px solid #d4af37bb",
                borderRadius: 8,
                padding: "18px 10px",
                textAlign: "center"
              }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#e8c874",
                  letterSpacing: 1.1
                }}>Referral #{idx + 1}</div>
                <div style={{
                  marginTop: 6,
                  fontFamily: "monospace",
                  color: "#50c878",
                  fontSize: 16
                }}>{shortAddr(addr)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card" style={{ background: "#0a1f44e8", border: "1.5px solid #d4af3722" }}>
        <div style={{ color: "#d4af37", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
          Recent Activity
        </div>
        <table className="transaction-table" style={{ width: "100%", background: "transparent", color: "#fff", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: "none", color: "#d4af37" }}>
              <th align="left" style={{ padding: "7px 0", fontWeight: 600 }}>Type</th>
              <th align="left" style={{ padding: "7px 0", fontWeight: 600 }}>Amount</th>
              <th align="left" style={{ padding: "7px 0", fontWeight: 600 }}>Date</th>
              <th align="left" style={{ padding: "7px 0", fontWeight: 600 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #2e4063" }}>
                <td>{tx.type}</td>
                <td>{tx.amount}</td>
                <td>{tx.date}</td>
                <td style={{ color: "#50c878", fontWeight: 600 }}>{tx.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ height: 34 }}></div>
    </div>
  );
}
