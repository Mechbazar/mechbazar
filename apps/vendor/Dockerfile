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

RUN npm install

COPY apps/vendor apps/vendor
COPY packages/shared packages/shared

RUN npm run build --workspace=apps/vendor

FROM nginx:alpine
COPY --from=build /usr/src/app/apps/vendor/dist /usr/share/nginx/html
COPY apps/vendor/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
