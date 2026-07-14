#!/bin/sh
set -eu

mc alias set local "${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}"
mc mb --ignore-existing "local/${S3_BUCKET_MEDIA}"
mc anonymous set none "local/${S3_BUCKET_MEDIA}"
mc cors set "local/${S3_BUCKET_MEDIA}" /config/cors.json
