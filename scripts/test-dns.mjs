import dns from "node:dns/promises";

try {
  const records = await dns.resolveSrv("_mongodb._tcp.clientcluster.fctnri3.mongodb.net");
  console.log(records);
} catch (err) {
  console.error(err);
}
