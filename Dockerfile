# Dev container for running coding agents on this repo
FROM node:24-bookworm

# System deps useful for coding agents
RUN apt-get update && apt-get install -y \
    git \
    curl \
    jq \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install opencode
RUN curl -fsSL https://opencode.ai/install | bash
ENV PATH="/root/.opencode/bin:$PATH"

# Install mattpocock/skills for all agents (opencode, claude, etc.)
RUN npx -y skills@latest add mattpocock/skills --all --global

WORKDIR /app

# Install dependencies (cached layer)
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy the rest of the source
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
