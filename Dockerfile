# Base image with Node.js
FROM node:18-slim

# Install necessary dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
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
    tzdata && \
    rm -rf /var/lib/apt/lists/*

# Set the timezone to Asia/Manila
RUN ln -snf /usr/share/zoneinfo/Asia/Manila /etc/localtime && echo "Asia/Manila" > /etc/timezone

# Install Puppeteer and fix missing Chromium dependency
RUN npm install puppeteer --global --unsafe-perm=true && \
    groupadd -r pptruser && \
    useradd -rm -g pptruser -G audio,video pptruser && \
    mkdir -p /home/pptruser/Downloads && \
    chown -R pptruser:pptruser /home/pptruser && \
    npm cache clean --force

# Run everything after as non-privileged user.
USER pptruser

# Expose display port (for debugging)
EXPOSE 9222

# Set working directory
WORKDIR /usr/src/app

# Copy over package.json, install project dependencies
COPY package.json ./
RUN npm install

# Copy the rest of the project
COPY . .

# Command to start your Puppeteer script
CMD ["node", "scrapper3.js"]
