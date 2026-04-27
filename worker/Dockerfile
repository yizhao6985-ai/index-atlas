# 默认使用阿里云「library」命名空间；PyPI/npm 走国内源，避免构建依赖 ghcr.io / Docker Hub。
# 海外构建可：docker build --build-arg BASE_PYTHON=python:3.11-slim-bookworm -f worker/Dockerfile .
ARG BASE_PYTHON=registry.cn-hangzhou.aliyuncs.com/library/python:3.11-slim-bookworm
FROM ${BASE_PYTHON}

RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONPATH=/app \
    UV_DEFAULT_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple

COPY worker/pyproject.toml worker/uv.lock ./
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

COPY worker/app ./app
CMD ["python", "-m", "app.main"]
