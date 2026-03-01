# ---- builder ----
FROM oven/bun:1 AS builder

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN bun install

# Copy source files
COPY . .

# Build the standalone server
RUN bun run build

# Prewarm: download and cache the model weights into the image layer
ENV HF_HOME=/app/.cache/huggingface
RUN bun app/prewarm.ts

# ---- runtime ----
FROM oven/bun:1-slim

WORKDIR /app

# Copy the compiled standalone server
COPY --from=builder /app/.aixyz/output ./

# Copy the prewarmed model cache so the server starts instantly
COPY --from=builder /app/.cache /app/.cache

ENV HF_HOME=/app/.cache/huggingface
ENV NODE_ENV=production

EXPOSE 3000

CMD ["bun", "server.js"]
