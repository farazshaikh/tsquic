#!/bin/bash
openssl ecparam -name prime256v1 -genkey -noout -out quic-key.pem
openssl req -new -key quic-key.pem -out quic.csr -subj "/CN=localhost"
openssl x509 -req -in quic.csr -signkey quic-key.pem -out quic-cert.pem -days 365 -extfile <(echo "subjectAltName=DNS:localhost")
openssl x509 -in quic-cert.pem -text -noout

