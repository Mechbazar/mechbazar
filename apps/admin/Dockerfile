FROM node:20-alpine AS build

WORKDIR /usr/src/app

# apps/admin depends on the local @mechbazar/shared workspace package (packages/shared),
# resolved via npm workspaces from the repo root -- it cannot be installed standalone
# (there is no published @mechbazar/shared on the npm registry). Building from an
# apps/admin-only context, as this Dockerfile previously did, fails with a 404 trying
# to fetch it. Build context must be the repo root (see docker-compose.yml) so the
# full workspace list resolves.
COPY package*.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/admin-mobile/package.json apps/admin-mobile/package.json
COPY apps/seller-mobile/package.json apps/seller-mobile/package.json
COPY apps/rider/package.json apps/rider/package.json
COPY apps/vendor/package.json apps/vendor/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install

COPY apps/admin apps/admin
COPY packages/shared packages/shared

RUN npm run build --workspace=apps/admin

FROM nginx:alpine
COPY --from=build /usr/src/app/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
