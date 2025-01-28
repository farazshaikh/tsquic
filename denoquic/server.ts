const privateKey = await Deno.readTextFile("../certs/quic-key.pem");
const certificate = await Deno.readTextFile("../certs/quic-cert.pem");

const endpoint = new Deno.QuicEndpoint({ port: 3090 });
let listener = endpoint.listen({
  key: privateKey,
  cert: certificate,
  alpnProtocols: ["h3"],
});

const conn = await listener.accept();

while (1) {
  const data = await conn.readDatagram();
  const utf8String = new TextDecoder().decode(data);
  console.log(utf8String);
  console.log("ACKing data");
  await conn.sendDatagram(new TextEncoder().encode("hellofromserver"));
  console.log("data sent");
}
conn.close();
