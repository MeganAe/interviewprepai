#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# Tests need a disposable PostgreSQL instance and a CREATEDB role (never production).
: "${TEST_POSTGRES_CONNECTION:?Set TEST_POSTGRES_CONNECTION for an isolated PostgreSQL test server}"
npm ci --prefix client
npm test --prefix client
dotnet test tests -c Release
npm run build --prefix client
dotnet publish server -c Release -r linux-x64 --self-contained false -p:UseAppHost=false -o artifacts/render-linux-x64
printf '\nProduction output: artifacts/render-linux-x64\n'
