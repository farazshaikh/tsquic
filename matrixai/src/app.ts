import { events, QUICClient, QUICServer, QUICStream } from "@matrixai/quic";
import Logger, { formatting, LogLevel, StreamHandler } from "@matrixai/logger";
import { clientCryptoOps, generateKeyHMAC, serverCryptoOps } from "./x509crypt";
import process from "node:process";
import { Buffer } from "node:buffer";
import { isUint32Array } from "node:util/types";
import {
  ReadableStream,
  ReadableStreamBYOBReader,
  ReadableStreamDefaultReader,
  TransformStream,
  WritableStream,
  WritableStreamDefaultWriter,
} from "stream/web";
import StreamConverter from "./streamconverter";

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

async function closeStreams(
  reader: ReadableStreamBYOBReader,
  writer: WritableStreamDefaultWriter,
) {
  try {
    await reader.cancel(); // Cancel the reader
  } catch {
    // Ignore errors
  }

  try {
    await writer.close(); // Close the writer
  } catch {
    // Ignore errors
  }
}

async function processProposalsStream(
  streamid: string,
  reader: ReadableStreamBYOBReader,
  writer: WritableStreamDefaultWriter,
) {
  console.log("Handling Proposals stream...");

  try {
    while (1) {
      // the action id is a u64 type in rust
      const actionIdA = new Uint32Array(2);
      const { value, done } = await reader.read(actionIdA);
      console.log("value read", value);
      if (done) {
        console.log("Stream ended");
        return null;
      }

      const actionId = BigInt(value[1]) << 32n | BigInt(value[0]);
      console.log(
        "Got ActionId",
        (BigInt(value[1]) << 32n).toString(16),
        actionId.toString(16),
      ); // Output as 64-bit BigInt

      // Write the SHA of the state ?
      const state_hash = new Uint8Array(64); // Create a 32-byte array
      crypto.getRandomValues(state_hash);
      console.log("State hash", state_hash as Uint8Array);
      await writer.write(state_hash); // Attempt to write
    }
  } catch {
    console.log("Proposal streams error closing stream", streamid);
  } finally {
    void reader.cancel().catch(() => {});
    void writer.close().catch(() => {});
  }
}

async function startStream(evt: Event) {
  const stream_event = evt as events.EventQUICConnectionStream;
  const stream = stream_event.detail;
  const creader = stream.readable.getReader();
  const byteStream = StreamConverter.convertToByteStream(creader);
  const reader = byteStream.getReader({
    mode: "byob",
  }) as ReadableStreamBYOBReader;

  //
  //const reader = stream.readable; // Use default reader mode
  //

  try {
    const buffer = new Uint8Array(1); // Create a buffer of 1 byte
    // Read one byte from the reader
    const { value, done } = await reader.read(buffer);
    console.log("value read", value);
    if (done) {
      console.log("Stream ended");
      return null;
    }

    // Determine the stream type and process accordingly
    switch (value[0] as StreamType) {
      case StreamType.Events:
        await processEventsStream(stream);
        break;
      case StreamType.Actions:
        await processActionsStream(stream);
        break;
      case StreamType.Proposals:
        await processProposalsStream(
          stream.streamId.toString(),
          reader,
          stream.writable.getWriter(),
        );
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

function bigintToUint8Array(value: bigint, byteLength: number): Uint8Array {
  const array = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    array[byteLength - 1 - i] = Number(value >> BigInt(i * 8) & 0xFFn);
  }
  return array;
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
  const reader = clientStream.readable.getReader();
  const streamtype = new Uint8Array([
    StreamType.Proposals,
  ]);
  await writer.write(streamtype);
  for (let _i = 0; _i < 10; _i++) {
    const actionId = bigintToUint8Array(0x12345678n, 8);
    await writer.write(actionId);
    let { value, done } = await reader.read();
    if (value != undefined) {
      console.log("State hash", value as Uint8Array);
    }
  }
  await clientStream.destroy();
}

async function main(mode: "server" | "client" = "server") {
  await loadCertificates();
  if (mode === "server") {
    await startServer();
    await startClient();
    await startClient();
  } else {
    await startClient();
  }
}
process.on("SIGINT", async () => {
  if (server) {
    console.log("Shutting down server...");
    await server.stop({ force: true });
    console.log("Server stopped.");
    process.exit(0);
  }
  if (client) {
    client.destroy({ force: true });
  }
});

const mode: "server" | "client" = process.argv[2] === "client"
  ? "client"
  : "server";

main(mode);
