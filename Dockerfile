# Build the Vite application with the public configuration supplied by Coolify.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

# The existing lockfile predates several build dependencies. `npm install`
# reconciles it in the ephemeral build stage, unlike `npm ci`, which aborts.
RUN npm install --include=dev --no-audit --no-fund

COPY . ./

# Vite substitutes VITE_* values while building. Configure these as build
# variables in Coolify; they are public client-side values, not secrets.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

RUN npm run build

# Serve the compiled SPA with a small, production-only image.
FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
