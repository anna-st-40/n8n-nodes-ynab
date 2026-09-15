# Quick Start Guide

Get up and running with the YNAB n8n node in minutes!

## Prerequisites

- n8n instance (Cloud or Self-Hosted)
- YNAB account with API access
- Node.js 18.17.0+ (for development)

## 1. Get Your YNAB API Token

1. Visit [YNAB Developer Settings](https://app.ynab.com/settings/developer)
2. Click **New Token**
3. Give it a name (e.g., "n8n Integration")
4. Copy and save your token securely

## 2. Install the Node

### Option A: Via n8n Community Nodes

1. Open n8n
2. Go to **Settings** > **Community Nodes**
3. Click **Install**
4. Enter: `n8n-nodes-ynab-api`
5. Click **Install**

### Option B: Manual Installation

```bash
# Navigate to n8n custom nodes directory
cd ~/.n8n/custom

# Clone the repository
git clone https://github.com/anna-st-40/n8n-nodes-ynab.git
cd n8n-nodes-ynab

# Install and build
npm install
npm run build

# Restart n8n
```

## 3. Configure Credentials

1. In n8n, click **Credentials** in the left sidebar
2. Click **Add Credential**
3. Search for **YNAB API**
4. Paste your API token
5. Click **Test** to verify
6. Click **Save**

## 4. Create Your First Workflow

### Simple Example: List All Plans

1. Create a new workflow
2. Add a **Manual Trigger** node
3. Add a **YNAB** node
4. Configure the YNAB node:
   - **Resource**: Plan
   - **Operation**: Get All
   - **Credentials**: Select your YNAB API credentials
5. Connect the nodes
6. Click **Test workflow**
7. View your plans in the output!

### Next Steps

Try these common operations:

- **Get Account Balances**: Resource → Account, Operation → Get All
- **Create Transaction**: Resource → Transaction, Operation → Create
- **View Categories**: Resource → Category, Operation → Get All

## Need Help?

- 📖 [Full Documentation](README.md)
- 🐛 [Report Issues](https://github.com/anna-st-40/n8n-nodes-ynab/issues)
- 💬 [YNAB API Docs](https://api.ynab.com)
- 🤝 [Contributing Guide](CONTRIBUTING.md)

## Pro Tips

1. **Use AI Agent**: Combine with n8n's AI Agent for intelligent budget management
2. **Milliunits**: YNAB amounts are in milliunits (10000 = $10.00)
3. **Plan IDs**: Get plan IDs using "Get All Plans" operation
4. **Test First**: Always test workflows with small amounts first

Happy Automating! 🌳💰
