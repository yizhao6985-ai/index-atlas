# 默认使用阿里云「library」命名空间（同步 Docker Hub 官方镜像），便于中国大陆拉取。
# 海外构建可：docker build --build-arg BASE_NODE=node:20-bookworm -f api/Dockerfile .
ARG BASE_NODE=registry.cn-hangzhou.aliyuncs.com/library/node:20-bookworm
FROM ${BASE_NODE}
WORKDIR /repo
COPY api api
WORKDIR /repo/api
RUN npm config set registry https://registry.npmmirror.com \
  && npm install
EXPOSE 3001
CMD ["npm", "start"]
