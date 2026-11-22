import dns from 'node:dns/promises';
import net from 'node:net';

// SSRF protection: users must not be able to make our server probe
// localhost, cloud metadata (169.254.169.254) or internal networks.
const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16], ['224.0.0.0', 4],
]) blocked.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10],
]) blocked.addSubnet(addr, prefix, 'ipv6');

export function isPrivateAddress(address) {
  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) -> check the embedded IPv4 address.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return isPrivateAddress(mapped[1]);
  const family = net.isIP(address);
  if (!family) return false;
  return blocked.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

/** Throws if the URL's host resolves to a private / reserved address. */
export async function assertPublicUrl(url) {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  let addresses;
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw new Error(`Could not resolve host "${host}"`);
    }
  }
  if (addresses.some(isPrivateAddress)) {
    throw new Error('Monitoring private or internal network addresses is not allowed');
  }
}
