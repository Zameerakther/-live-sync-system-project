FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY shared ./shared
COPY backend/package.json ./backend/
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src

RUN npm run install:all
RUN npm run build --workspace=backend

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 5000
CMD ["node", "dist/server.js"]
