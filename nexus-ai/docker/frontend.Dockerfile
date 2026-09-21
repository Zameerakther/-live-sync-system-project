FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY shared ./shared
COPY frontend ./frontend

RUN npm run install:all
RUN npm run build --workspace=frontend

FROM nginx:alpine

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
