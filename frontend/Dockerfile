# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Declare ARGs to receive variables from docker-compose
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL

# Set them as environment variables for the build process
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci || npm install
COPY . .

# Vite will now replace import.meta.env variables with the values above
RUN npm run build

# Serve stage
FROM nginx:1.25-alpine
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]