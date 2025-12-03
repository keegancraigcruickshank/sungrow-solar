ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js
RUN apk add --no-cache nodejs npm

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY rootfs/app/package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application code
COPY rootfs/app/ ./

# Copy run script
COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
