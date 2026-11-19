#!/usr/bin/env bash
set -Eeuo pipefail

: "${APP_DB_USER:?APP_DB_USER must be set}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD must be set}"

psql --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=app_user="$APP_DB_USER" \
  --set=app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE :"POSTGRES_DB" TO :"app_user";
GRANT USAGE, CREATE ON SCHEMA public TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"app_user" IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"app_user" IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO :"app_user";
SQL
