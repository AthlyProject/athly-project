FROM node:24-alpine AS builder
WORKDIR /app

ARG VITE_BACKEND_API_URL
ARG VITE_ENABLE_REGISTRATION

ENV VITE_BACKEND_API_URL=$VITE_BACKEND_API_URL
ENV VITE_ENABLE_REGISTRATION=$VITE_ENABLE_REGISTRATION

COPY athly-frontend/package*.json ./
RUN npm ci
COPY athly-frontend/ .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./dist
RUN npm install -g serve
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
