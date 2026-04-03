FROM node:22-alpine

RUN npm i -g pnpm

WORKDIR /app

# Copy root config (IMPORtANT for turborepo)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./


COPY apps ./apps
COPY packages ./packages


RUN pnpm install --shamefully-hoist

# Move to frontend app
WORKDIR /app/apps/frontend


EXPOSE 5173

CMD [ "pnpm", "run", "dev" ]