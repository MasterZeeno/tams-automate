# Use Node.js 18 (Bullseye) as the base image
FROM node:18-bullseye AS base

# Set environment variables early to use cache efficiently
ENV LANG=en_PH.UTF-8 \
    TZ=Asia/Manila \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    DOCKER_BUILDKIT=1

# Set timezone
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Install dependencies for pnpm and Chrome in one RUN to reduce layers
RUN apt-get update \
    && apt-get install -yq libgconf-2-4 \
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

RUN groupadd -r pptruser && useradd -rm -g pptruser -G audio,video pptruser

USER pptruser

WORKDIR /home/pptruser

COPY package.json pnpm-lock.yaml ./

# Install dependencies with pnpm in a separate layer to leverage cache more effectively
RUN pnpm install --frozen-lockfile

# Now copy the rest of the application code
COPY . .

# Expose the result folder in case of scraping results
VOLUME [ "/home/pptruser/results" ]

# Default command to run Puppeteer scripts
CMD ["pnpm", "run", "test"]