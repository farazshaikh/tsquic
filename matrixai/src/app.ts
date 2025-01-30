import { events, QUICClient, QUICServer, QUICStream } from "@matrixai/quic";
import Logger, { formatting, LogLevel, StreamHandler } from "@matrixai/logger";
import { clientCryptoOps, generateKeyHMAC, serverCryptoOps } from "./x509crypt";
import process from "node:process";
import { Buffer } from "node:buffer";

let server: QUICServer | undefined;
let client: QUICClient | undefined;
const QUIC_SERVER_PORT = 3090;
const localhost = "localhost";
const { promises: fs } = require("node:fs");
let privateKey: string;
let certificate: string;

enum StreamType {
  Events = 0,
  Actions = 1,
  Proposals = 2,
}

async function loadCertificates() {
  privateKey = await fs.readFile("../certs/quic-key.pem", "utf8");
  certificate = await fs.readFile("../certs/quic-cert.pem", "utf8");
}

async function processEventsStream(stream: QUICStream) {
  console.log("Handling Events stream...");
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function processActionsStream(stream: QUICStream) {
  console.log("Handling Actions stream...");
  await new Promise((resolve) => setTimeout(resolve, 0));
  // Read/write logic for Actions stream
}

async function processProposalsStream(stream: QUICStream) {
  console.log("Handling Proposals stream...");
  await new Promise((resolve) => setTimeout(resolve, 0)); //
  // Read/write logic for Proposals stream
}

async function startStream(evt: Event) {
  const stream_event = evt as events.EventQUICConnectionStream;
  const stream = stream_event.detail;
  const reader = stream.readable.getReader(); // Use default reader mode
  const buffer = new Uint8Array(1); // Create a buffer of 1 byte

  try {
    // Read one byte from the reader
    const { value, done } = await reader.read();
    if (done) {
      console.log("Stream ended");
      return null;
    }
    buffer.set(value.slice(0, 1)); // Copy the first byte to the buffer
    console.log("Read byte:", buffer[0]);

    // Determine the stream type and process accordingly
    switch (buffer[0] as StreamType) {
      case StreamType.Events:
        await processEventsStream(stream);
        break;
      case StreamType.Actions:
        await processActionsStream(stream);
        break;
      case StreamType.Proposals:
        await processProposalsStream(stream);
        break;
      default:
        console.log("Unknown stream type");
        return null;
    }
  } finally {
    reader.releaseLock();
  }
}

function newConnection(evt: Event) {
  const conn_evt = evt as events.EventQUICServerConnection;
  const connection = conn_evt.detail;
  console.log("Connection received");
  connection.addEventListener(
    events.EventQUICConnectionStream.name,
    startStream,
  );
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

  server.addEventListener(
    events.EventQUICServerConnection.name,
    newConnection,
  );

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
  client = await QUICClient.createQUICClient({
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

  const clientStream = client.connection.newStream();
  const writer = clientStream.writable.getWriter();
  const eventTypeBuffer = new Uint8Array([StreamType.Events]);
  await writer.write(eventTypeBuffer);
  await clientStream.destroy();
}

async function main(mode: "server" | "client" = "server") {
  await loadCertificates();
  if (mode === "server") {
    await startClient();
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
