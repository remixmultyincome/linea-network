import { ethers } from "ethers";

export function getProvider(endpoint) {
  return window.ethereum
    ? new ethers.BrowserProvider(window.ethereum)
    : new ethers.JsonRpcProvider(endpoint);
}
