FROM node:20-alpine AS build

WORKDIR /usr/src/app

# apps/mobile is deliberately NOT a member of the root npm workspace (see this
# app's metro.config.js for why), but it does depend on the local shared
# package -- "@mechbazar/shared": "file:../../packages/shared" in its
# package.json. npm resolves that relative to the app directory, so
# packages/shared has to be present in the image at install time.
#
# That is why the build context is the repo root (see docker-compose.yml)
# rather than ./apps/mobile as it used to be. An apps/mobile-only context
# cannot see ../../packages/shared, and the web bundle fails with "Unable to
# resolve module @mechbazar/shared from src/screens/auth/WelcomeScreen.tsx".
# Nothing surfaced this until the wordmark <Logo/> landed, because that is the
# first thing in this app to import the shared package -- so the very first
# deploy carrying the new logo was also the first build that could fail.
#
# apps/admin and apps/vendor already build from the repo root for this reason.
COPY packages/shared packages/shared
COPY apps/mobile apps/mobile

# Install and build from the app directory so npm treats it as a standalone
# project, which is how it resolves locally.
WORKDIR /usr/src/app/apps/mobile
RUN npm install --legacy-peer-deps

# Expo bakes these into the static bundle at build time -- setting them in the
# container's runtime environment is too late, the JS is already built by then.
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}
ARG EXPO_PUBLIC_FIREBASE_VAPID_KEY
ENV EXPO_PUBLIC_FIREBASE_VAPID_KEY=${EXPO_PUBLIC_FIREBASE_VAPID_KEY}
ARG EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
ENV EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=${EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}

RUN npm run build:web

FROM nginx:alpine
COPY --from=build /usr/src/app/apps/mobile/dist /usr/share/nginx/html
COPY apps/mobile/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
