# Stage 1: the SDK builds the Material frontend, then publishes the Linux backend.
FROM mcr.microsoft.com/dotnet/sdk:8.0-bookworm-slim AS build
# Node is copied from its official Debian image; no curl-to-shell installer.
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
WORKDIR /src
COPY client/package*.json ./client/
RUN npm ci --prefix client --no-audit --no-fund
COPY server/server.csproj ./server/
RUN dotnet restore server/server.csproj -r linux-x64
COPY client/ ./client/
RUN npm run build --prefix client
COPY server/ ./server/
RUN dotnet publish server/server.csproj -c Release -r linux-x64 --self-contained false --no-restore -o /publish /p:UseAppHost=false

# Stage 2: no SDK, Node, source files, local database or credentials in the runtime.
# Add the official Supabase CA as Render Secret File: supabase-ca.crt.
# Npgsql 8 reads PGSSLROOTCERT; keep SSL Mode=VerifyFull in the connection string.
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /publish/ ./
COPY licenses/ ./licenses/
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://0.0.0.0:10000 \
    PGSSLROOTCERT=/etc/secrets/supabase-ca.crt
EXPOSE 10000
# Render secret files are readable by group 1000. Keep the non-root app UID.
USER app:1000
ENTRYPOINT ["dotnet", "server.dll"]
