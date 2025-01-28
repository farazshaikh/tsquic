import { QUICClient, QUICServer, QUICSocket } from "@matrixai/quic";
import Logger, { formatting, LogLevel, StreamHandler } from "@matrixai/logger";
import {
  clientCryptoOps,
  generateKeyHMAC,
  generateRSAKey,
  generateRSAX509,
  keyPairRSAToPEM,
  randomBytes,
  serverCryptoOps,
} from "./x509crypt";
import { start } from "repl";

let server: QUICServer | undefined;
let client: QUICClient | undefined;
const QUIC_SERVER_PORT = 3090;
const localhost = "localhost";
const { promises: fs } = require("fs");
let privateKey: string;
let certificate: string;

async function loadCertificates() {
  privateKey = await fs.readFile("../certs/quic-key.pem", "utf8");
  console.log("loading key", privateKey);
  certificate = await fs.readFile("../certs/quic-cert.pem", "utf8");
  console.log("loading cert", certificate);
}

async function startServer() {
  const logger = new Logger("N1TSRollmanServer", LogLevel.DEBUG, [
    new StreamHandler(
      formatting
        .format`${formatting.level}:${formatting.keys}:${formatting.msg}`,
    ),
  ]);

  console.log("Starting server");
  console.log(privateKey);
  console.log("---");
  console.log(certificate);
  /* Build HMAC */
  const hmacKey = await generateKeyHMAC();
  server = new QUICServer({
    crypto: {
      key: hmacKey,
      ops: serverCryptoOps,
    },
    config: {
      applicationProtos: ["h3", "h3-29", "h3-28", "h3-27"],
      ca: certificate, // Self issued, self CA,
      cert: certificate,
      key: privateKey,
      verifyPeer: false,
    },
    logger: logger.getChild("QUICServer"),
  });

  await server.start({
    host: localhost,
    port: QUIC_SERVER_PORT,
  });
  console.log(server.port);
}

async function startClient() {
  const logger = new Logger("N1TSRollmanClient", LogLevel.DEBUG, [
    new StreamHandler(
      formatting
        .format`${formatting.level}:${formatting.keys}:${formatting.msg}`,
    ),
  ]);

  console.log("Creating QUIC client");
  const client1 = await QUICClient.createQUICClient({
    host: localhost,
    port: QUIC_SERVER_PORT,
    localHost: localhost,
    crypto: {
      ops: clientCryptoOps,
    },
    logger: logger.getChild(QUICClient.name),

    config: {
      applicationProtos: ["h3", "h3-29", "h3-28", "h3-27"],
      ca: certificate,
      verifyPeer: true,
      verifyCallback: async (
        certs: Array<Uint8Array>,
        ca: Array<Uint8Array>,
      ) => {
        console.log("Client TLS verification callback");
        //verifyProm.resolveP(certs);
        return undefined;
      },
    },
  });
}

async function main(mode: "server" | "client" = "server") {
  await loadCertificates();
  if (mode === "server") {
    await startServer();
  } else {
    await startClient();
  }
}
process.on("SIGINT", async () => {
  if (server) {
    console.log("Shutting down server...");
    await server.stop();
    console.log("Server stopped.");
    process.exit(0);
  }
});

const mode: "server" | "client" = process.argv[2] === "client"
  ? "client"
  : "server";

main(mode);
