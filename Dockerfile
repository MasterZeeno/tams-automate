# Base image with Node.js and Chromium dependencies
FROM node:18-slim

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
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
    libu2f-udev \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Optional: if using Puppeteer with no sandbox mode
RUN npm install puppeteer

# Set environment variable to allow running as root
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Run the Puppeteer script (adjust with your script's name)
CMD ["node", "your-puppeteer-script.js"]
