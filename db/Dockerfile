# 将迁移 SQL 复制进镜像，避免宿主机 bind 挂载时 root-only 权限导致 initdb 内 psql 无法读文件。
# 修改 db/migrations 后请执行：docker compose build db && docker compose up -d（或 up --build）。
FROM postgres:16-alpine
COPY migrations/ /docker-entrypoint-initdb.d/
