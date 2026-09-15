<img src="nodes/Ynab/ynab.svg" alt="YNAB logo" width="96">

# n8n-nodes-ynab-api

This is an n8n community node. It lets you use [YNAB](https://www.ynab.com/) in your n8n workflows.

YNAB (You Need A Budget) is a zero-based budgeting service. Its API exposes your plans, accounts, categories, payees, transactions, and monthly budget data, so you can automate categorization, reporting, and transaction import.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)  
[Version history](#version-history)  

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation, using the package name `n8n-nodes-ynab-api`.

## Operations

The node covers every endpoint in YNAB API v1. Plans, accounts, categories, and payees use n8n resource locators, so you can search by name, pick from a list, or paste an ID.

* **Plan**: Get all, Get, Get settings
* **Account**: Get all, Get, Create
* **Category**: Get all, Get, Create, Update, Get month category, Update month category, Create group, Update group
* **Payee**: Get all, Get, Create, Update
* **Payee Location**: Get all (optionally filtered to a single payee), Get
* **Month**: Get all, Get
* **Money Movement**: Get all movements, Get all groups (both optionally scoped to a month)
* **Transaction**: Get all, Get, Create, Update, Delete, Update multiple, Import
* **Scheduled Transaction**: Get all, Get, Create, Update, Delete
* **User**: Get user info

## Credentials

Authentication uses a YNAB Personal Access Token. You need a YNAB account.

1. Open [YNAB developer settings](https://app.ynab.com/settings/developer).
2. Click **New Token** and give it a name, for example `n8n Integration`.
3. Copy the token — YNAB shows it only once.
4. In n8n, create new credentials of type **YNAB API** and paste the token.
5. Click **Test** to verify the connection, then **Save**.

The token grants full read and write access to every plan on the account. Revoke it from the same YNAB settings page if it is ever exposed.

## Compatibility

* **n8n**: 1.110.1 or newer
* **Node.js**: 20.19 or newer; CI builds and lints against Node.js 20.x and 22.x
* **YNAB API**: v1

## Usage

New to n8n? Start with the [Try it out](https://docs.n8n.io/try-it-out/) documentation.

### Amounts are in milliunits

YNAB represents money in milliunits: `10000` is $10.00, and outflows are negative. Multiply by 1000 when you build a transaction, and divide by 1000 when you report a balance.

### Example workflow

[examples/get-all-plans.json](examples/get-all-plans.json) is a ready-to-import workflow that lists your plans. Import it from **Workflows** > **Import from File**, then select your credentials.

To create a transaction, set **Resource** to `Transaction` and **Operation** to `Create`, then pick the plan and account and fill in the date (`YYYY-MM-DD`), amount in milliunits, payee, and cleared status.

### Using the node as an AI Agent tool

The node sets `usableAsTool`, so an AI Agent can call any YNAB operation directly. On self-hosted n8n you first have to allow community packages as tools:

```bash
export N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true
```

Then connect the YNAB node to the tools input of an **AI Agent** (Tools Agent) node. The agent picks the operation from the request, so prompts like "what's my total balance across all accounts?" or "add a $50 transaction at Starbucks in my coffee category" work without extra wiring.

Because a Personal Access Token can write to your real budget, give agents that can create, update, or delete transactions the usual review before letting them run unattended.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [YNAB API documentation](https://api.ynab.com)
* [YNAB Personal Access Tokens](https://api.ynab.com/#personal-access-tokens)

## Version history

* **1.0.0** — First release under this package name. Full coverage of YNAB API v1, including money movements, category groups, payee locations, bulk transaction updates, and transaction import; resource locators for plans, accounts, categories, and payees; AI Agent tool support; and YNAB's current Plans terminology in place of Budgets.

## License and attribution

[MIT](LICENSE). Copyright (c) 2025 Nikko Pabion, Copyright (c) 2026 Anna Stefaniv Oickle.

This project is a fork of [Npab19/n8n-nodes-YNAB](https://github.com/Npab19/n8n-nodes-YNAB) by Nikko Pabion, used under the MIT License. The fork brings the node up to full parity with the current YNAB API: it rewrites most of the node implementation, adds the remaining resources and operations, and converts the ID fields to resource locators.

See [NOTICE](NOTICE) for fork attribution and trademark information. This is an independent community integration and is not affiliated with, endorsed by, or sponsored by You Need A Budget LLC.
