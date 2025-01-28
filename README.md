# QUIC Server Examples in TypeScript

This repository provides examples of implementing a QUIC server in TypeScript.
As of 2025, the Node.js and Deno communities are not very eager to support QUIC,
as these platforms are mostly targeting backend services. Consequently, there
weren't many minimal examples of running QUIC servers in TypeScript.

This repository includes two examples of QUIC servers:

1. Using Deno's native experimental TypeScript support.
2. Using the JavaScript module `matrixai/js-quic`, which is based on Rust's
   QUICHE library.

Additionally, TLS 1.3 has some caveats for QUIC. The `certs` folder contains
scripts to generate working self-signed certificates.

Use this repository primarily as a template for a TypeScript QUIC server.

## Generating Certificates

To generate the necessary self-signed certificates for running the QUIC servers,
use the provided script in the `certs` folder. Follow these steps:

```bash
pushd
cd certs
chmod 755 gencerts.sh
./gencerts.sh
popd
```

This will generate the `quic-key.pem`, `quic.csr`, and `quic-cert.pem` files
needed for TLS 1.3.

## Running the examples:

### Matrix AI

```
pushd
cd ./matrixai
npm install
npm run startserver
npm run startclient
popd
```

### Deno

```
Install latest version with experimental QUIC support. cicrca from DEC 2024
pushd
cd ./denoquic
popd
```

### More debugging

Typescript makes setting up the QUIC server easy, however the TLS1.3 config can
run into many and varied issues. The following tools and help debuggin QUIC
connections

1. Wireshark on loopback with display filter set to upd.port == 3090
2. handlshake packets encrypte and can be decrypted for viewing in wireshark.
   search for SSLKEYLOGFILE on google and follow https://wiki.wireshark.org/TLS
3. QUICHE Rust repo provides basic tools for checking basic functionality.
4. You can bisect issues by mixmatching servers and clients across (DENO, NODE,
   QUICHE)

```
RUST_LOG=debug cargo run --bin quiche-server \
-- --cert ../nodequic/certs/quic-cert.pem --key ../nodequic/certs/quic-key.pem \
--listen 127.0.0.1:3090

 RUST_LOG=quiche::tls=trace cargo run --bin quiche-client -- \ 
  --no-verify --trust-origin-ca-pem ../nodequic/certs/quic-cert.pem \
  https://127.0.0.1:3090
```
