# Use Node.js 18 (Bullseye) as the base image
FROM node:18-bullseye

# Install pnpm globally
RUN npm i -g pnpm

# Install dependencies for Google Chrome and Puppeteer
RUN apt-get update \
    && apt-get install -yq libgconf-2-4 \
    && apt-get install -y wget --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && apt-get install -y --no-install-recommends \
       fonts-liberation \
       libappindicator3-1 \
       libasound2 \
       libatk-bridge2.0-0 \
       libatk1.0-0 \
       libcups2 \
       libdbus-1-3 \
       libdrm2 \
       libgbm1 \
       libgtk-3-0 \
       libnspr4 \
       libnss3 \
       libx11-xcb1 \
       libxcomposite1 \
       libxdamage1 \
       libxrandr2 \
       xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set timezone
RUN ln -snf /usr/share/zoneinfo/Asia/Manila /etc/localtime && echo "Asia/Manila" > /etc/timezone

# Skip downloading Chromium since we are using Google Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV HCC_BASE_URL=https://hcc-tams.com.ph
ENV TAMS_BASE_URL=https://hcc-tams.com.ph/tams
ENV ZEE_USERNAME=15913
ENV ZEE_PASSWORD=546609529

# Create a user for Puppeteer to avoid running as root
RUN groupadd -r pptruser && useradd -rm -g pptruser -G audio,video pptruser

# Set the working directory
WORKDIR /usr/src/app

# Set ownership to Puppeteer user
RUN mkdir -p /usr/src/app/results && chown -R pptruser:pptruser /usr/src/app

# Switch to the Puppeteer user
USER pptruser

# Copy the package.json and pnpm-lock.yaml files to install dependencies
COPY --chown=pptruser:pptruser package.json pnpm-lock.yaml ./

# Install project dependencies using pnpm
RUN pnpm install

# Copy all project files to the working directory
COPY --chown=pptruser:pptruser . .

# Expose the result folder in case of scraping results
VOLUME [ "/usr/src/app/results" ]

# Entry point for running your Puppeteer scripts
CMD ["pnpm", "run", "test"]
