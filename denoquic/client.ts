const caCert = await Deno.readTextFile("../certs/quic-cert.pem");

const conn1 = await Deno.connectQuic({
  caCerts: [caCert],
  hostname: "localhost",
  port: 3090,
  alpnProtocols: ["h3"],
});
while (1) {
  await conn1.sendDatagram(new TextEncoder().encode("hellofromclient"));
  console.log("Client hello sent");
  const data = await conn1.readDatagram();
  console.log("recieved data");
  let data2 = new TextDecoder().decode(data);
  console.log(data2);
}
conn1.close();
while (1);
