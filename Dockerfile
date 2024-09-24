# Base image with Node.js
FROM node:18-slim

# Set the timezone to Asia/Manila
RUN ln -snf /usr/share/zoneinfo/Asia/Manila /etc/localtime && \
    echo "Asia/Manila" > /etc/timezone

# Install necessary dependencies and Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
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
    tzdata \
    wget \
    gnupg && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g puppeteer --unsafe-perm=true && \
    npx puppeteer install && \
    groupadd -r pptruser && \
    useradd -rm -g pptruser -G audio,video pptruser && \
    mkdir -p /home/pptruser/Downloads && \
    mkdir -p /usr/src/app && \
    chown -R pptruser:pptruser /home/pptruser && \
    chown -R pptruser:pptruser /usr/src/app && \
    npm cache clean --force

# Set working directory
WORKDIR /usr/src/app

# Copy over package.json and install project dependencies
COPY package.json ./ 
RUN npm install

# Copy the rest of the project files
COPY . .

# Run everything after as non-privileged user
USER pptruser

# Expose display port (for debugging)
EXPOSE 9222

# Command to start your Puppeteer script
CMD ["node", "scrapper3.js"]
