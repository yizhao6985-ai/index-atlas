# 默认使用阿里云「library」命名空间（同步 Docker Hub 官方镜像），便于中国大陆拉取。
ARG BASE_NODE=registry.cn-hangzhou.aliyuncs.com/library/node:20-bookworm
FROM ${BASE_NODE} AS build
WORKDIR /repo
COPY web web
WORKDIR /repo/web
RUN npm config set registry https://registry.npmmirror.com \
  && npm install && npm run build

ARG BASE_NGINX=registry.cn-hangzhou.aliyuncs.com/library/nginx:1.27-alpine
FROM ${BASE_NGINX}
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/web/dist /usr/share/nginx/html
