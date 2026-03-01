FROM node:20-slim

# Install basic tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -m -u 1001 swarm
USER swarm

# Set working directory
WORKDIR /workspace

# Default command
CMD ["node", "-v"]
