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
COPY apps/mechanic/package.json apps/mechanic/package.json
COPY apps/vendor/package.json apps/vendor/package.json
COPY packages/shared/package.json packages/shared/package.json

# apps/mechanic was missing from the COPY list above until now -- since it's
# a real npm workspace (see root package.json), omitting its package.json
# silently dropped its @react-native-firebase/* peer requirements from this
# install's dependency graph entirely, so `npm install` here resolved a
# DIFFERENT tree than the one that produced the committed package-lock.json
# (generated locally with all 7 workspaces present). That's what caused
# "Component auth has not been registered yet" in production even after
# package.json's firebase/react overrides were verified to fix it locally.
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

# Firebase Email/Password auth client config -- same reasoning as above,
# must be baked in at build time. Public client identifiers, not secrets.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY}
ENV VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN}
ENV VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID}
ENV VITE_FIREBASE_STORAGE_BUCKET=${VITE_FIREBASE_STORAGE_BUCKET}
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=${VITE_FIREBASE_MESSAGING_SENDER_ID}
ENV VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID}

RUN npm run build --workspace=apps/vendor

FROM nginx:alpine
COPY --from=build /usr/src/app/apps/vendor/dist /usr/share/nginx/html
COPY apps/vendor/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
