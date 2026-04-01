# ---- builder ----
FROM oven/bun:1-slim AS builder
WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .
RUN bun run build

# Prewarm: download, cache, and validate the model weights
RUN bun prewarm.ts

# ---- runtime ----
FROM oven/bun:1-slim
WORKDIR /app

COPY --from=builder /app/.aixyz/output ./
COPY --from=builder /app/.cache/transformers /app/.cache/transformers
# onnxruntime-node + sharp native bindings required by @huggingface/transformers
COPY --from=builder /app/node_modules/onnxruntime-node/bin /bin
COPY --from=builder /app/node_modules/sharp /app/node_modules/sharp
COPY --from=builder /app/node_modules/@img /app/node_modules/@img
RUN echo /app/node_modules/@img/sharp-libvips-*/lib > /etc/ld.so.conf.d/sharp.conf && ldconfig

ENV NODE_ENV=production
ENV TRANSFORMERS_OFFLINE=1

EXPOSE 3000

CMD ["bun", "server.js"]
