FROM node:20-bookworm AS build
WORKDIR /repo
COPY web web
WORKDIR /repo/web
RUN npm install && npm run build

FROM nginx:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/web/dist /usr/share/nginx/html
