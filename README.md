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
