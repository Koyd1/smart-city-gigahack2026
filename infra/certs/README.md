Place production TLS certificate files here:
- cert.pem
- key.pem

For local smoke testing you can generate self-signed certs:
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout infra/certs/key.pem \
  -out infra/certs/cert.pem \
  -subj "/CN=localhost"
