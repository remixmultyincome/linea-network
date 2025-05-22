// src/utils.js
export function getSponsorFromUrlOrDefault(defaultSponsor) {
  const params = new URLSearchParams(window.location.search);
  let sponsor = params.get("ref");
  if (!sponsor || !/^0x[a-fA-F0-9]{40}$/.test(sponsor)) {
    sponsor = defaultSponsor;
  }
  return sponsor;
}