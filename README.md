<img src="https://cdn.prod.website-files.com/640f69143ec11b21d42015c6/6758a5396561162bbe65ae5c_524ab88af6960dd452642470297f8130_Tree%20Logo%20Blurple%20(2).svg" alt="YNAB logo" width="96">

# n8n-nodes-ynab-api

Community n8n node for the YNAB (You Need A Budget) API — work with your plans, accounts, categories, payees, payee locations, months, money movements, transactions, and scheduled transactions directly from n8n workflows.

## Why this node

- **Complete API coverage** — every endpoint in the current YNAB API v1, including money movements, category groups, payee locations, bulk transaction updates, and transaction import.
- **Searchable resource pickers** — plans, accounts, categories, and payees use n8n resource locators, so you can search by name, pick from a list, or paste an ID instead of hunting through a flat dropdown.
- **Works as an AI Agent tool** — the node sets `usableAsTool`, so an n8n AI Agent can call any YNAB operation directly.
- **Current API terminology** — tracks YNAB's rename of Budgets to Plans.

## Attribution

This project is a fork of [Npab19/n8n-nodes-YNAB](https://github.com/Npab19/n8n-nodes-YNAB) by Nikko Pabion, used under the MIT License. It was forked to bring the node up to full parity with the current YNAB API; the fork rewrites most of the node implementation, adds the remaining resources and operations, and converts the ID fields to resource locators.

## Features

### Supported Resources and Operations

- **Plans**: Get all, get by ID, get settings
- **Accounts**: Get all, get by ID, create
- **Categories**: Get all, get by ID, create, update, get month category, update month category, create group, update group
- **Payees**: Get all, get by ID, create, update
- **Payee Locations**: Get all, get by ID, filter by payee ID
- **Months**: Get all, get by month
- **Money Movements**: Get all movements, get all groups, optional month scoping
- **Transactions**: Get all, get by ID, create, update, delete, update multiple, import
- **Scheduled Transactions**: Get all, get by ID, create, update, delete
- **User**: Get authenticated user information

### Authentication

Uses YNAB Personal Access Token for authentication.

## Installation

### For n8n Cloud or Self-Hosted

#### Option 1: Install via npm (Recommended)

1. Go to **Settings** > **Community Nodes**
2. Click **Install**
3. Enter `n8n-nodes-ynab-api`
4. Click **Install**

#### Option 2: Manual Installation

For self-hosted n8n instances:

```bash
# Navigate to your n8n custom nodes directory
cd ~/.n8n/custom

# Clone this repository
git clone https://github.com/anna-st-40/n8n-nodes-ynab.git

# Install dependencies and build
cd n8n-nodes-ynab
npm install
npm run build

# Restart n8n
```

### For Development

1. Clone this repository:
   ```bash
   git clone https://github.com/anna-st-40/n8n-nodes-ynab.git
   cd n8n-nodes-ynab
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the node:
   ```bash
   npm run build
   ```

4. Link for local n8n development:
   ```bash
   npm link
   cd ~/.n8n/custom
   npm link n8n-nodes-ynab-api
   ```

5. Start your local n8n instance and test the node

## Usage

### Setting up Credentials

#### Getting Your YNAB API Token

1. Go to [YNAB Account Settings](https://app.ynab.com/settings/developer)
2. Click on **New Token**
3. Give it a name (e.g., "n8n Integration")
4. Copy the generated token (you won't be able to see it again!)

#### Configuring in n8n

1. In n8n, create new credentials of type **"YNAB API"**
2. Paste your YNAB Personal Access Token
3. Click **Test** to verify the connection
4. Click **Save**

### Example Workflow: Get All Plans

1. Add a "Manual Trigger" node
2. Add a "YNAB" node
3. Configure the YNAB node:
   - **Resource**: Plan
   - **Operation**: Get All
   - **Include Accounts**: true (optional)
4. Connect the credentials
5. Execute the workflow

### Example Workflow: Create Transaction

1. Add a trigger node
2. Add a "YNAB" node
3. Configure the YNAB node:
   - **Resource**: Transaction
   - **Operation**: Create
   - **Plan ID**: Your plan ID
   - **Account ID**: Your account ID
   - **Date**: Transaction date (YYYY-MM-DD)
   - **Amount**: Amount in milliunits (e.g., 10000 = $10.00)
   - **Payee Name**: Payee name
   - **Memo**: Optional memo
   - **Cleared**: uncleared/cleared/reconciled

## Common Use Cases

### Budget Monitoring
- Get all plans and their balances
- Monitor spending across categories
- Track account balances
- Generate budget reports

### Transaction Management
- Create transactions automatically from external sources
- Update transaction categories and memos
- Reconcile transactions programmatically
- Import transactions from other services

### AI-Powered Budgeting
- Use with n8n's AI Agent for intelligent budget analysis
- Get spending recommendations based on patterns
- Automate categorization with AI
- Generate natural language budget summaries

### Automation Examples
- Auto-categorize recurring transactions
- Send notifications when budgets are exceeded
- Sync transactions between multiple plans
- Generate monthly spending reports

## API Reference

This node implements the YNAB API v1. For more information about YNAB API:
- [YNAB API Documentation](https://api.ynab.com)
- [Get Personal Access Token](https://api.ynab.com/#personal-access-tokens)

## Development

### File Structure

```
.
├── credentials/
│   └── YnabApi.credentials.ts      # YNAB API credentials definition
├── nodes/
│   └── Ynab/
│       ├── Ynab.node.ts            # Main node implementation
│       ├── Ynab.node.json          # Node codex metadata
│       └── ynab.svg                # Node icon
├── dist/                           # Compiled JavaScript (generated)
├── .development/                   # Development test files
├── package.json                    # Node package configuration
└── tsconfig.json                   # TypeScript configuration
```

### Building

```bash
npm run build
```

### Linting

```bash
npm run lint
npm run lintfix  # Auto-fix issues
```

## Compatibility

- **n8n version**: 1.110.1+
- **Node.js**: 18.17.0+
- **YNAB API**: v1

## License

[MIT](LICENSE). Copyright (c) 2025 Nikko Pabion, Copyright (c) 2026 Anna Stefaniv Oickle.

## Support

For issues and questions:
- This node: https://github.com/anna-st-40/n8n-nodes-ynab/issues
- YNAB API: https://api.ynab.com
- n8n Documentation: https://docs.n8n.io

## AI Agent Compatibility

This node is fully compatible with n8n's AI Agent (LangChain) and can be used as a tool by AI agents.

### Using with AI Agents

1. **Enable Community Package Tool Usage** (required for self-hosted n8n):
   ```bash
   export N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
   ```
   Or add to your n8n environment configuration.

2. **Add as a Tool to AI Agent**:
   - Add an **AI Agent** node (Tools Agent type)
   - Connect the YNAB node to the AI Agent's tools input
   - The AI will automatically use YNAB operations when needed

3. **Example AI Agent Use Cases**:
   - "What's my total budget balance across all accounts?"
   - "Create a transaction for $50 at Starbucks in my coffee category"
   - "Show me all transactions from last week"
   - "What categories am I overspending in?"
   - "Add a $100 payment to my credit card account"

The AI agent can intelligently select the appropriate YNAB operations (get plans, create transactions, etc.) based on natural language requests.

### AI Agent Workflow Example

```
Manual Trigger → AI Agent (Tools Agent) → [Connected Tools]
                                            ├─ YNAB Node
                                            └─ Other Tools
```

The node uses `usableAsTool: true` to enable AI agent integration, allowing the AI to understand and utilize all available YNAB operations dynamically.