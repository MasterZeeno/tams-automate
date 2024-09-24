# Use Node.js 18 (Bullseye) as the base image
FROM node:18-bullseye AS base

# Set environment variables early to use cache efficiently
ENV TZ=Asia/Manila \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Set timezone
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Install dependencies for pnpm and Chrome in one RUN to reduce layers
RUN apt-get update \
    && apt-get install -yq \
       libgconf-2-4 wget --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
       fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 \
       libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 \
       libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \
       libxrandr2 xdg-utils \
    && npm install -g pnpm \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Pre-cache dependencies by copying only the lock files first, enabling Docker to cache them
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml ./

# Install dependencies with pnpm in a separate layer to leverage cache more effectively
RUN pnpm install --frozen-lockfile

# Now copy the rest of the application code
COPY . .

# Create a user for Puppeteer to avoid running as root
RUN groupadd -r pptruser && useradd -rm -g pptruser -G audio,video pptruser \
    && mkdir -p /usr/src/app/results \
    && chown -R pptruser:pptruser /usr/src/app

# Switch to Puppeteer user for security
USER pptruser

# Expose the result folder in case of scraping results
VOLUME [ "/usr/src/app/results" ]

# Default command to run Puppeteer scripts
CMD ["pnpm", "run", "test"]