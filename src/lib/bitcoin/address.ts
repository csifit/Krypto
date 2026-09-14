export type WatchChainType = "ethereum" | "bitcoin";

export function bitcoinAddressKey(address: string) {
  return address.toLowerCase().startsWith("bc1") ? address.toLowerCase() : address;
}

export function watchAddressKey(chainType: WatchChainType, address: string) {
  return chainType === "ethereum"
    ? `ethereum:${address.toLowerCase()}`
    : `bitcoin:${bitcoinAddressKey(address)}`;
}

export function looksLikeBitcoinMainnetAddress(address: string) {
  const value = address.trim();
  if (/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(value)) return true;
  return /^bc1[ac-hj-np-z02-9]{11,71}$/i.test(value);
}
