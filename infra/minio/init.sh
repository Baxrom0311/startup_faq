#!/bin/sh
set -eu

mc alias set local "${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}"
mc mb --ignore-existing "local/${S3_BUCKET_MEDIA}"
mc anonymous set none "local/${S3_BUCKET_MEDIA}"

# Build CORS allowed origins from env vars.
# FRONTEND_HOST is required; EXTRA_CORS_ORIGINS is an optional comma-separated list.
ORIGINS="\"${FRONTEND_HOST:-http://localhost:5173}\""
if [ -n "${EXTRA_CORS_ORIGINS:-}" ]; then
  for origin in $(echo "$EXTRA_CORS_ORIGINS" | tr ',' ' '); do
    ORIGINS="${ORIGINS}, \"${origin}\""
  done
fi

cat > /tmp/cors.json <<EOF
[
  {
    "AllowedOrigins": [${ORIGINS}],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
EOF

mc cors set "local/${S3_BUCKET_MEDIA}" /tmp/cors.json
