# Installing n8n-nodes-ynab on Docker n8n

This guide shows you how to install the YNAB custom node on a Docker-based n8n server.

## Method 1: Using Docker Volumes (Recommended)

This method mounts the custom node into your n8n Docker container.

### Step 1: Clone the Repository on Your Docker Server

SSH into your Docker server and clone the repository:

```bash
# SSH into your server
ssh user@your-server-ip

# Navigate to a directory (e.g., /opt)
cd /opt

# Clone the repository
git clone https://github.com/anna-st-40/n8n-nodes-ynab.git
cd n8n-nodes-ynab

# Install dependencies and build
npm install
npm run build
```

### Step 2: Update Your Docker Compose File

Add a volume mount to your n8n Docker Compose configuration:

**If you use docker-compose.yml:**

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_CUSTOM_EXTENSIONS=/data/custom
    volumes:
      - n8n_data:/home/node/.n8n
      - /opt/n8n-nodes-ynab:/data/custom/n8n-nodes-ynab  # Add this line
    restart: unless-stopped

volumes:
  n8n_data:
```

### Step 3: Restart n8n

```bash
docker-compose down
docker-compose up -d
```

## Method 2: Build Custom Docker Image

Create a custom Docker image with the node pre-installed.

### Step 1: Create a Dockerfile

On your Docker server, create a new directory and Dockerfile:

```bash
mkdir n8n-custom
cd n8n-custom
```

Create `Dockerfile`:

```dockerfile
FROM n8nio/n8n:latest

USER root

# Install the YNAB node
RUN cd /usr/local/lib/node_modules && \
    git clone https://github.com/anna-st-40/n8n-nodes-ynab.git n8n-nodes-ynab-api && \
    cd n8n-nodes-ynab-api && \
    npm install --omit=dev && \
    npm run build && \
    chown -R node:node /usr/local/lib/node_modules/n8n-nodes-ynab-api

USER node

# Set environment variable
ENV NODE_FUNCTION_ALLOW_EXTERNAL=*
```

### Step 2: Build and Run

```bash
# Build the custom image
docker build -t n8n-with-ynab .

# Run the container
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  n8n-with-ynab
```

**Or with docker-compose:**

```yaml
version: '3.8'

services:
  n8n:
    build: .
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
    restart: unless-stopped

volumes:
  n8n_data:
```

Then run:
```bash
docker-compose up -d --build
```

## Method 3: Install After Container is Running

If you already have n8n running and want to install the node without rebuilding:

### Step 1: Clone Repository on Host

```bash
cd /opt
git clone https://github.com/anna-st-40/n8n-nodes-ynab.git
cd n8n-nodes-ynab
npm install
npm run build
```

### Step 2: Copy into Running Container

```bash
# Get your n8n container name
docker ps | grep n8n

# Copy the built node into the container
docker cp /opt/n8n-nodes-ynab n8n_container_name:/home/node/.n8n/custom/

# Fix permissions
docker exec -u root n8n_container_name chown -R node:node /home/node/.n8n/custom/n8n-nodes-ynab

# Restart the container
docker restart n8n_container_name
```

## Method 4: Using n8n's Custom Nodes Directory

If your n8n Docker setup has a custom nodes directory mounted:

### Step 1: Check Your Current Setup

```bash
docker inspect n8n_container_name | grep -A 10 Mounts
```

Look for a mount like `/home/node/.n8n/custom`

### Step 2: Clone to Mounted Directory

```bash
# Find where your n8n custom directory is mounted on the host
# Example: /var/lib/n8n/custom

cd /var/lib/n8n/custom  # Adjust to your path
git clone https://github.com/anna-st-40/n8n-nodes-ynab.git
cd n8n-nodes-ynab
npm install
npm run build
```

### Step 3: Restart n8n

```bash
docker restart n8n_container_name
```

## Verification

After installation, verify the node is loaded:

1. Open n8n in your browser: `http://your-server-ip:5678`
2. Create a new workflow
3. Click to add a node
4. Search for "YNAB"
5. You should see the YNAB node with the blue tree logo

## Troubleshooting

### Node Not Appearing

**Check container logs:**
```bash
docker logs n8n_container_name
```

**Verify the node files are present:**
```bash
docker exec n8n_container_name ls -la /home/node/.n8n/custom/
```

**Check environment variables:**
```bash
docker exec n8n_container_name env | grep N8N
```

### Permission Issues

If you see permission errors:
```bash
docker exec -u root n8n_container_name chown -R node:node /home/node/.n8n/custom/
docker restart n8n_container_name
```

### Build Issues

If npm install fails in the container:
```bash
# Build on host, then copy just the dist folder
cd /opt/n8n-nodes-ynab
npm install
npm run build
docker cp dist n8n_container_name:/home/node/.n8n/custom/n8n-nodes-ynab/
docker cp package.json n8n_container_name:/home/node/.n8n/custom/n8n-nodes-ynab/
```

## Configuration

After installation, configure YNAB credentials:

1. Go to **Credentials** in n8n
2. Click **Add Credential**
3. Search for **YNAB API**
4. Enter your YNAB Personal Access Token
   - Get it from: https://app.ynab.com/settings/developer
5. Test and Save

## Updating the Node

To update to the latest version:

```bash
# On your Docker host
cd /opt/n8n-nodes-ynab
git pull
npm install
npm run build

# Restart n8n
docker restart n8n_container_name
```

## Example Docker Compose (Complete Setup)

Here's a complete docker-compose.yml with the YNAB node:

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=your_password_here
      - N8N_HOST=your-domain.com
      - N8N_PROTOCOL=https
      - NODE_ENV=production
      - WEBHOOK_URL=https://your-domain.com/
    volumes:
      - n8n_data:/home/node/.n8n
      - /opt/n8n-nodes-ynab:/home/node/.n8n/custom/n8n-nodes-ynab
    restart: unless-stopped

volumes:
  n8n_data:
```

## Need Help?

- **Documentation**: https://github.com/anna-st-40/n8n-nodes-ynab
- **Issues**: https://github.com/anna-st-40/n8n-nodes-ynab/issues
- **n8n Docs**: https://docs.n8n.io/hosting/installation/docker/
