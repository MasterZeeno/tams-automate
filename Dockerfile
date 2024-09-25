# Use Node.js 18 (Bullseye) as the base image
FROM node:18-bullseye AS base

# Set environment variables early to use cache efficiently
ENV TZ=Asia/Manila \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    DOCKER_BUILDKIT=1

# Set timezone
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Install dependencies for pnpm and Chrome in one RUN to reduce layers
RUN apt-get update \
    # See https://crbug.com/795759
    && apt-get install -yq libgconf-2-4 \
    # Install latest chrome dev package, which installs the necessary libs to
    # make the bundled version of Chromium that Puppeteer installs work.
    && apt-get install -y wget --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && wget https://mirrors.edge.kernel.org/ubuntu/pool/main/g/gcc-10/gcc-10-base_10-20200411-0ubuntu1_amd64.deb \
    && dpkg -i gcc-10-base_10-20200411-0ubuntu1_amd64.deb \
    && wget https://mirrors.edge.kernel.org/ubuntu/pool/main/g/gcc-10/libgcc-s1_10-20200411-0ubuntu1_amd64.deb \
    && dpkg -i libgcc-s1_10-20200411-0ubuntu1_amd64.deb \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
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