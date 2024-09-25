# Use Node.js 18 (Bullseye) as the base image
FROM node:18-bullseye AS base

# Set environment variables early to use cache efficiently
ENV LANG=en_PH.UTF-8 \
    TZ=Asia/Manila \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    DOCKER_BUILDKIT=1 \
    BUILDKIT_CONTEXT_KEEP_GIT_DIR=1 \
    BUILDKIT_INLINE_CACHE=1 \
    BUILDKIT_MULTI_PLATFORM=1

# Set timezone
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Install dependencies for pnpm and Chrome in one RUN to reduce layers
RUN apt-get update \
    && apt-get install -yq libgconf-2-4 \
    && apt-get install -y wget --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && npm install -g pnpm \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN groupadd -r pptruser && useradd -rm -g pptruser -G audio,video pptruser

USER pptruser

WORKDIR /home/pptruser

COPY . .

RUN pnpm install --frozen-lockfile

# Expose the result folder in case of scraping results
VOLUME [ "/home/pptruser/results" ]

# Default command to run Puppeteer scripts
CMD ["pnpm", "run", "test"]