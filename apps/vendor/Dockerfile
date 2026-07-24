FROM node:20-alpine AS build

WORKDIR /usr/src/app

# Same reasoning as apps/admin/Dockerfile: apps/vendor depends on the local
# @mechbazar/shared workspace package, which only resolves via npm workspaces
# from the repo root. Build context must be the repo root (see docker-compose.yml).
COPY package*.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/admin-mobile/package.json apps/admin-mobile/package.json
COPY apps/seller-mobile/package.json apps/seller-mobile/package.json
COPY apps/rider/package.json apps/rider/package.json
COPY apps/vendor/package.json apps/vendor/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install --legacy-peer-deps

COPY apps/vendor apps/vendor
COPY packages/shared packages/shared

# Vite bakes these into the static bundle at build time -- must be passed as
# --build-arg, not just set in the container's runtime environment (that's
# too late, the JS is already built by then). Without these, the app falls
# back to guessing http://<hostname>:5001/api at runtime, which breaks under
# HTTPS (mixed content) and isn't proxied anywhere.
ARG VITE_API_URL
ARG VITE_SERVER_ORIGIN
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SERVER_ORIGIN=${VITE_SERVER_ORIGIN}

RUN npm run build --workspace=apps/vendor

FROM nginx:alpine
COPY --from=build /usr/src/app/apps/vendor/dist /usr/share/nginx/html
COPY apps/vendor/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
