FROM node:20-alpine AS builder

# better-sqlite3 native build toolchain
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
COPY shared ./shared
COPY backend/package.json ./backend/
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src

RUN npm run install:all
RUN npm run build --workspace=backend

FROM node:20-alpine

# ffmpeg for media tools; python3/make/g++ kept for better-sqlite3 runtime rebuilds if needed
RUN apk add --no-cache ffmpeg python3 make g++

WORKDIR /app
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
# schema.sql is read at runtime relative to dist/
COPY backend/src/database/schema.sql ./dist/database/schema.sql

ENV NEXUS_DATA_DIR=/data
VOLUME ["/data"]

EXPOSE 5000
CMD ["node", "dist/server.js"]
