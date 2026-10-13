# Multi-stage Dockerfile for Proyecto AI Frontend (Web)
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies using lockfile
COPY package*.json ./
RUN npm ci

# Copy source and export static web assets
COPY . .
RUN npx expo export -p web

# Serve with lightweight Nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
