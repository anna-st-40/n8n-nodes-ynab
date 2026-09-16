import { createHash } from 'node:crypto';

import {
	NodeConnectionTypes,
	NodeOperationError,
	INodeType,
	INodeTypeDescription,
	INodeListSearchItems,
	INodeListSearchResult,
	IExecuteSingleFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	IHttpRequestOptions,
} from 'n8n-workflow';

type LocatorItem = { id: string; name: string };
type LocatorCacheEntry = { fetchedAt: number; items: LocatorItem[] };

export class Ynab implements INodeType {
	private static readonly LOCATOR_CACHE_TTL_MS = 300_000;

	private static readonly LOCATOR_CACHE_MAX_ENTRIES = 500;

	private static getLocatorValue(input: unknown): string {
		if (typeof input === 'string') return input.trim();
		if (!input || typeof input !== 'object') return '';

		const candidate = input as { value?: unknown; id?: unknown };
		if (typeof candidate.value === 'string') return candidate.value.trim();
		if (typeof candidate.id === 'string') return candidate.id.trim();
		if (candidate.value && typeof candidate.value === 'object') {
			const nested = candidate.value as { id?: unknown; value?: unknown };
			if (typeof nested.id === 'string') return nested.id.trim();
			if (typeof nested.value === 'string') return nested.value.trim();
		}

		return '';
	}

	private static locatorCache = new Map<string, LocatorCacheEntry>();

	/**
	 * Builds the cache-key prefix for the credential currently in use.
	 *
	 * n8n instantiates one node class per process and shares it across every
	 * workflow and user on the instance, so cache keys must be scoped to the
	 * credential. Without this, one user's plan, account and category names
	 * would be served from cache to anyone else on the same instance.
	 *
	 * The access token is hashed rather than used directly so the plaintext
	 * token is never held as a map key. Returns null when no token is
	 * available, which disables caching rather than sharing an unscoped key.
	 */
	private static async getCacheScope(context: ILoadOptionsFunctions): Promise<string | null> {
		try {
			const credentials = await context.getCredentials('ynabApi');
			const accessToken = String(credentials?.accessToken ?? '');
			if (!accessToken) return null;

			return createHash('sha256').update(accessToken).digest('hex').slice(0, 32);
		} catch {
			return null;
		}
	}

	private static readLocatorCache(key: string | null): LocatorItem[] | undefined {
		if (!key) return undefined;

		const entry = Ynab.locatorCache.get(key);
		if (!entry) return undefined;

		if (Date.now() - entry.fetchedAt >= Ynab.LOCATOR_CACHE_TTL_MS) {
			Ynab.locatorCache.delete(key);
			return undefined;
		}

		return entry.items;
	}

	private static writeLocatorCache(key: string | null, items: LocatorItem[]): void {
		if (!key) return;

		const now = Date.now();

		// Evict expired entries first, then oldest-inserted, so an instance with
		// many credentials cannot grow the cache without bound.
		for (const [existingKey, entry] of Ynab.locatorCache) {
			if (now - entry.fetchedAt >= Ynab.LOCATOR_CACHE_TTL_MS) {
				Ynab.locatorCache.delete(existingKey);
			}
		}

		while (Ynab.locatorCache.size >= Ynab.LOCATOR_CACHE_MAX_ENTRIES) {
			const oldestKey = Ynab.locatorCache.keys().next().value;
			if (oldestKey === undefined) break;
			Ynab.locatorCache.delete(oldestKey);
		}

		Ynab.locatorCache.set(key, { fetchedAt: now, items });
	}

	description: INodeTypeDescription = {
		displayName: 'YNAB',
		name: 'ynab',
		icon: { light: 'file:../../icons/ynab.svg', dark: 'file:../../icons/ynab.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with YNAB (You Need A Budget) API',
		defaults: {
			name: 'YNAB',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'ynabApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: 'https://api.ynab.com/v1',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Account',
						value: 'account',
					},
					{
						name: 'Category',
						value: 'category',
					},
					{
						name: 'Money Movement',
						value: 'moneyMovement',
					},
					{
						name: 'Month',
						value: 'month',
					},
					{
						name: 'Payee',
						value: 'payee',
					},
					{
						name: 'Payee Location',
						value: 'payeeLocation',
					},
					{
						name: 'Plan',
						value: 'plan',
					},
					{
						name: 'Scheduled Transaction',
						value: 'scheduledTransaction',
					},
					{
						name: 'Transaction',
						value: 'transaction',
					},
					{
						name: 'User',
						value: 'user',
					},
				],
				default: 'plan',
			},

			// Plan Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['plan'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get many plans',
						action: 'Get many plans',
						routing: {
							request: {
								method: 'GET',
								url: '/plans',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.plans',
										},
									},
								],
							},
						},
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single plan',
						action: 'Get a plan',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.plan',
										},
									},
								],
							},
						},
					},
					{
						name: 'Get Settings',
						value: 'getSettings',
						description: 'Get plan settings',
						action: 'Get plan settings',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}/settings',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.settings',
										},
									},
								],
							},
						},
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Plan',
				name: 'planId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['plan'],
						operation: ['get', 'getSettings'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchPlans',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. last-used',
					},
				],
				description: 'Select a plan from the list or enter a plan ID',
			},
			{
				displayName: 'Include Accounts',
				name: 'include_accounts',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['plan'],
						operation: ['getAll'],
					},
				},
				default: false,
				description: 'Whether to include the list of plan accounts',
				routing: {
					request: {
						qs: {
							include_accounts: '={{$value}}',
						},
					},
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				displayOptions: {
					show: {
						resource: ['plan'],
						operation: ['get'],
					},
				},
				default: {},
				placeholder: 'Add Field',
				options: [
					{
						displayName: 'Last Knowledge of Server',
						name: 'lastKnowledgeOfServer',
						type: 'string',
						default: '',
						description:
							'If provided, only entities changed since this server knowledge value are returned',
						routing: {
							request: {
								qs: {
									last_knowledge_of_server: '={{$value || undefined}}',
								},
							},
						},
					},
				],
			},

			// Account Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['account'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get many accounts for a plan',
						action: 'Get many accounts',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}/accounts',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.accounts',
										},
									},
								],
							},
						},
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single account',
						action: 'Get an account',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}/accounts/{{$parameter.accountId}}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.account',
										},
									},
								],
							},
						},
					},
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new account',
						action: 'Create an account',
						routing: {
							request: {
								method: 'POST',
								url: '=/plans/{{$parameter.planId}}/accounts',
							},
							send: {
								type: 'body',
								property: 'account',
								preSend: [
									async function (
										this: IExecuteSingleFunctions,
										requestOptions: IHttpRequestOptions,
									): Promise<IHttpRequestOptions> {
										const body = {
											account: {
												name: this.getNodeParameter('accountName') as string,
												type: this.getNodeParameter('accountType') as string,
												balance: this.getNodeParameter('balance') as number,
											},
										};
										return {
											...requestOptions,
											body,
										};
									},
								],
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.account',
										},
									},
								],
							},
						},
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Plan',
				name: 'planId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['account'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchPlans',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. last-used',
					},
				],
				description: 'Select a plan from the list or enter a plan ID',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				displayOptions: {
					show: {
						resource: ['account'],
						operation: ['getAll'],
					},
				},
				default: {},
				placeholder: 'Add Field',
				options: [
					{
						displayName: 'Last Knowledge of Server',
						name: 'lastKnowledgeOfServer',
						type: 'string',
						default: '',
						description:
							'If provided, only entities changed since this server knowledge value are returned',
						routing: {
							request: {
								qs: {
									last_knowledge_of_server: '={{$value || undefined}}',
								},
							},
						},
					},
				],
			},
			{
				displayName: 'Account',
				name: 'accountId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['account'],
						operation: ['get'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchAccounts',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 00000000-0000-0000-0000-000000000000',
					},
				],
				description: 'Select an account from the selected plan or enter an account ID',
			},
			{
				displayName: 'Account Name',
				name: 'accountName',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['account'],
						operation: ['create'],
					},
				},
				default: '',
				description: 'The name of the account',
			},
			{
				displayName: 'Account Type',
				name: 'accountType',
				type: 'options',
				required: true,
				displayOptions: {
					show: {
						resource: ['account'],
						operation: ['create'],
					},
				},
				options: [
					{ name: 'Cash', value: 'cash' },
					{ name: 'Checking', value: 'checking' },
					{ name: 'Credit Card', value: 'creditCard' },
					{ name: 'Line of Credit', value: 'lineOfCredit' },
					{ name: 'Other Asset', value: 'otherAsset' },
					{ name: 'Other Liability', value: 'otherLiability' },
					{ name: 'Savings', value: 'savings' },
				],
				default: 'checking',
				description: 'The type of account',
			},
			{
				displayName: 'Balance',
				name: 'balance',
				type: 'number',
				required: true,
				displayOptions: {
					show: {
						resource: ['account'],
						operation: ['create'],
					},
				},
				default: 0,
				description: 'The current balance of the account in milliunits format',
			},

			// Transaction Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get many transactions',
						action: 'Get many transactions',
						routing: {
							request: {
								method: 'GET',
								url: '={{(() => { const planPath = "/plans/" + $parameter.planId; switch ($parameter.transactionListScope || "plan") { case "account": return planPath + "/accounts/" + $parameter.transactionAccountId + "/transactions"; case "category": return planPath + "/categories/" + $parameter.transactionCategoryId + "/transactions"; case "payee": return planPath + "/payees/" + $parameter.transactionPayeeId + "/transactions"; case "month": return planPath + "/months/" + $parameter.transactionMonth + "/transactions"; default: return planPath + "/transactions"; } })() }}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.transactions',
										},
									},
								],
							},
						},
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single transaction',
						action: 'Get a transaction',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}/transactions/{{$parameter.transactionId}}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.transaction',
										},
									},
								],
							},
						},
					},
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new transaction',
						action: 'Create a transaction',
						routing: {
							request: {
								method: 'POST',
								url: '=/plans/{{$parameter.planId}}/transactions',
							},
							send: {
								type: 'body',
								property: 'transaction',
								preSend: [
									async function (
										this: IExecuteSingleFunctions,
										requestOptions: IHttpRequestOptions,
									): Promise<IHttpRequestOptions> {
										const payeeName = (
											this.getNodeParameter('payeeName') as string
										).trim();
										const memo = (this.getNodeParameter('memo') as string).trim();

										const transaction: IDataObject = {
											account_id: this.getNodeParameter('accountId') as string,
											date: this.getNodeParameter('date') as string,
											amount: this.getNodeParameter('amount') as number,
											cleared: this.getNodeParameter('cleared', 'uncleared') as string,
										};

										if (payeeName) {
											transaction.payee_name = payeeName;
										}

										if (memo) {
											transaction.memo = memo;
										}

										const body = {
											transaction,
										};
										return {
											...requestOptions,
											body,
										};
									},
								],
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.transaction',
										},
									},
								],
							},
						},
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update a transaction',
						action: 'Update a transaction',
						routing: {
							request: {
								method: 'PUT',
								url: '=/plans/{{$parameter.planId}}/transactions/{{$parameter.transactionId}}',
							},
							send: {
								type: 'body',
								property: 'transaction',
								preSend: [
									async function (
										this: IExecuteSingleFunctions,
										requestOptions: IHttpRequestOptions,
									): Promise<IHttpRequestOptions> {
										const payeeName = (
											this.getNodeParameter('payeeName') as string
										).trim();
										const memo = (this.getNodeParameter('memo') as string).trim();

										const transaction: IDataObject = {
											account_id: this.getNodeParameter('accountId') as string,
											date: this.getNodeParameter('date') as string,
											amount: this.getNodeParameter('amount') as number,
											cleared: this.getNodeParameter('cleared', 'uncleared') as string,
										};

										if (payeeName) {
											transaction.payee_name = payeeName;
										}

										if (memo) {
											transaction.memo = memo;
										}

										const body = {
											transaction,
										};
										return {
											...requestOptions,
											body,
										};
									},
								],
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.transaction',
										},
									},
								],
							},
						},
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a transaction',
						action: 'Delete a transaction',
						routing: {
							request: {
								method: 'DELETE',
								url: '=/plans/{{$parameter.planId}}/transactions/{{$parameter.transactionId}}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.transaction',
										},
									},
								],
							},
						},
					},
					{
						name: 'Update Multiple',
						value: 'updateMultiple',
						description: 'Update multiple transactions',
						action: 'Update multiple transactions',
						routing: {
							request: {
								method: 'PATCH',
								url: '=/plans/{{$parameter.planId}}/transactions',
							},
							send: {
								type: 'body',
								property: 'transactions',
								preSend: [
									async function (
										this: IExecuteSingleFunctions,
										requestOptions: IHttpRequestOptions,
									): Promise<IHttpRequestOptions> {
										const rawTransactions = String(
											this.getNodeParameter('transactionsJson') || '',
										).trim();

										if (!rawTransactions) {
											throw new NodeOperationError(this.getNode(), 'Transactions JSON is required');
										}

										let transactions: IDataObject[];
										try {
											transactions = JSON.parse(rawTransactions) as IDataObject[];
										} catch {
											throw new NodeOperationError(this.getNode(), 'Invalid JSON supplied for transactions');
										}

										if (!Array.isArray(transactions)) {
											throw new NodeOperationError(this.getNode(), 'Transactions must be a JSON array');
										}

										return {
											...requestOptions,
											body: { transactions },
										};
									},
								],
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.transactions',
										},
									},
								],
							},
						},
					},
					{
						name: 'Import',
						value: 'import',
						description: 'Import transactions',
						action: 'Import transactions',
						routing: {
							request: {
								method: 'POST',
								url: '=/plans/{{$parameter.planId}}/transactions/import',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data',
										},
									},
								],
							},
						},
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Plan',
				name: 'planId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchPlans',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. last-used',
					},
				],
				description: 'Select a plan from the list or enter a plan ID',
			},
			{
				displayName: 'Scope',
				name: 'transactionListScope',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['getAll'],
					},
				},
				options: [
					{
						name: 'Account',
						value: 'account',
						description: 'Return transactions for a single account',
					},
					{
						name: 'Category',
						value: 'category',
						description: 'Return transactions for a single category',
					},
					{
						name: 'Month',
						value: 'month',
						description: 'Return transactions for a specific month',
					},
					{
						name: 'Payee',
						value: 'payee',
						description: 'Return transactions for a single payee',
					},
					{
						name: 'Plan',
						value: 'plan',
						description: 'Return all plan transactions',
					},
				],
				default: 'plan',
				description:
					'Select which transactions endpoint to query. Plan is the default and returns all non-pending transactions for the plan. The other scopes require a target ID or month and map to the account, category, payee, or month-specific list endpoints from the API.',
			},
			{
				displayName: 'Account',
				name: 'transactionAccountId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['getAll'],
						transactionListScope: ['account'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchAccounts',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 00000000-0000-0000-0000-000000000000',
					},
				],
				description: 'Select an account from the selected plan or enter an account ID',
			},
			{
				displayName: 'Category',
				name: 'transactionCategoryId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['getAll'],
						transactionListScope: ['category'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchCategories',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 00000000-0000-0000-0000-000000000000',
					},
				],
				description: 'Select a category from the selected plan or enter a category ID',
			},
			{
				displayName: 'Payee ID',
				name: 'transactionPayeeId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['getAll'],
						transactionListScope: ['payee'],
					},
				},
				default: '',
				description: 'The ID of the payee',
			},
			{
				displayName: 'Month',
				name: 'transactionMonth',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['getAll'],
						transactionListScope: ['month'],
					},
				},
				default: '',
				description: 'The plan month in ISO format (YYYY-MM-DD) or current',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['getAll'],
					},
				},
				default: {},
				placeholder: 'Add Field',
				options: [
					{
						displayName: 'Last Knowledge of Server',
						name: 'lastKnowledgeOfServer',
						type: 'string',
						default: '',
						description:
							'If provided, only entities changed since this server knowledge value are returned',
						routing: {
							request: {
								qs: {
									last_knowledge_of_server: '={{$value || undefined}}',
								},
							},
						},
					},
					{
						displayName: 'Since Date',
						name: 'sinceDate',
						type: 'string',
						default: '',
						description:
							'Only transactions on or after this ISO date (YYYY-MM-DD) are returned',
						routing: {
							request: {
								qs: {
									since_date: '={{$value || undefined}}',
								},
							},
						},
					},
					{
						displayName: 'Type',
						name: 'transactionType',
						type: 'options',
						options: [
							{ name: 'None', value: '' },
							{ name: 'Uncategorized', value: 'uncategorized' },
							{ name: 'Unapproved', value: 'unapproved' },
						],
						default: '',
						description: 'Filter transactions by transaction type',
						routing: {
							request: {
								qs: {
									type: '={{$value || undefined}}',
								},
							},
						},
					},
				],
			},
			{
				displayName: 'Transactions JSON',
				name: 'transactionsJson',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['updateMultiple'],
					},
				},
				default: '[]',
				placeholder: '[{"ID":"...","amount":12345}]',
				description: 'JSON array of transaction updates',
			},
			{
				displayName: 'Transaction ID',
				name: 'transactionId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['get', 'update', 'delete'],
					},
				},
				default: '',
				description: 'The ID of the transaction',
			},
			{
				displayName: 'Account',
				name: 'accountId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['create', 'update'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchAccounts',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 00000000-0000-0000-0000-000000000000',
					},
				],
				description: 'Select an account from the selected plan or enter an account ID',
			},
			{
				displayName: 'Date',
				name: 'date',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'The transaction date in ISO format (YYYY-MM-DD)',
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'number',
				required: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['create', 'update'],
					},
				},
				default: 0,
				description: 'The transaction amount in milliunits format',
			},
			{
				displayName: 'Payee Name',
				name: 'payeeName',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'The name of the payee',
			},
			{
				displayName: 'Memo',
				name: 'memo',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'Transaction memo',
			},
			{
				displayName: 'Cleared',
				name: 'cleared',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['create', 'update'],
					},
				},
				options: [
					{ name: 'Cleared', value: 'cleared' },
					{ name: 'Uncleared', value: 'uncleared' },
					{ name: 'Reconciled', value: 'reconciled' },
				],
				default: 'uncleared',
				description: 'The cleared status of the transaction',
			},

			// Category Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['category'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get many categories',
						action: 'Get many categories',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}/categories',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.category_groups',
										},
									},
								],
							},
						},
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single category',
						action: 'Get a category',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}/categories/{{$parameter.categoryId}}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.category',
										},
									},
								],
							},
						},
					},
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new category',
						action: 'Create a category',
						routing: {
							request: {
								method: 'POST',
								url: '=/plans/{{$parameter.planId}}/categories',
							},
							send: {
								type: 'body',
								property: 'category',
								preSend: [
									async function (
										this: IExecuteSingleFunctions,
										requestOptions: IHttpRequestOptions,
									): Promise<IHttpRequestOptions> {
										const categoryName = String(this.getNodeParameter('categoryName') || '').trim();
										const parentCategoryGroupId = String(
											this.getNodeParameter('parentCategoryGroupId') || '',
										).trim();

										if (!categoryName) {
											throw new NodeOperationError(this.getNode(), 'Category name is required');
										}

										if (!parentCategoryGroupId) {
											throw new NodeOperationError(this.getNode(), 'Parent category group ID is required');
										}

										const category: IDataObject = {
											name: categoryName,
											category_group_id: parentCategoryGroupId,
										};

										const note = String(this.getNodeParameter('note') || '').trim();
										if (note) {
											category.note = note;
										}

										const goalTarget = this.getNodeParameter('goalTarget');
										if (typeof goalTarget === 'number' && Number.isFinite(goalTarget)) {
											category.goal_target = goalTarget;
										}

										const goalTargetDate = String(this.getNodeParameter('goalTargetDate') || '').trim();
										if (goalTargetDate) {
											category.goal_target_date = goalTargetDate;
										}

										return {
											...requestOptions,
											body: { category },
										};
									},
								],
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.category',
										},
									},
								],
							},
						},
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update a category',
						action: 'Update a category',
						routing: {
							request: {
								method: 'PATCH',
								url: '=/plans/{{$parameter.planId}}/categories/{{$parameter.categoryId}}',
							},
							send: {
								type: 'body',
								property: 'category',
								preSend: [
									async function (
										this: IExecuteSingleFunctions,
										requestOptions: IHttpRequestOptions,
									): Promise<IHttpRequestOptions> {
										const category: IDataObject = {};

										const categoryName = String(this.getNodeParameter('categoryName') || '').trim();
										if (categoryName) {
											category.name = categoryName;
										}

										const parentCategoryGroupId = String(
											this.getNodeParameter('parentCategoryGroupId') || '',
										).trim();
										if (parentCategoryGroupId) {
											category.category_group_id = parentCategoryGroupId;
										}

										const note = String(this.getNodeParameter('note') || '').trim();
										if (note) {
											category.note = note;
										}

										const goalTarget = this.getNodeParameter('goalTarget');
										if (typeof goalTarget === 'number' && Number.isFinite(goalTarget)) {
											category.goal_target = goalTarget;
										}

										const goalTargetDate = String(this.getNodeParameter('goalTargetDate') || '').trim();
										if (goalTargetDate) {
											category.goal_target_date = goalTargetDate;
										}

										return {
											...requestOptions,
											body: { category },
										};
									},
								],
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.category',
										},
									},
								],
							},
						},
					},
					{
						name: 'Get Month',
						value: 'getMonth',
						description: 'Get a category for a specific plan month',
						action: 'Get a month category',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}/months/{{$parameter.month}}/categories/{{$parameter.categoryId}}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.category',
										},
									},
								],
							},
						},
					},
					{
						name: 'Update Month',
						value: 'updateMonth',
						description: 'Update a category for a specific month',
						action: 'Update a month category',
						routing: {
							request: {
								method: 'PATCH',
								url: '=/plans/{{$parameter.planId}}/months/{{$parameter.month}}/categories/{{$parameter.categoryId}}',
							},
							send: {
								type: 'body',
								property: 'category',
								preSend: [
									async function (
										this: IExecuteSingleFunctions,
										requestOptions: IHttpRequestOptions,
									): Promise<IHttpRequestOptions> {
										return {
											...requestOptions,
											body: {
												category: {
													budgeted: this.getNodeParameter('budgeted') as number,
												},
											},
										};
									},
								],
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.category',
										},
									},
								],
							},
						},
					},
					{
						name: 'Create Group',
						value: 'createGroup',
						description: 'Create a new category group',
						action: 'Create a category group',
						routing: {
							request: {
								method: 'POST',
								url: '=/plans/{{$parameter.planId}}/category_groups',
							},
							send: {
								type: 'body',
								property: 'category_group',
								preSend: [
									async function (
										this: IExecuteSingleFunctions,
										requestOptions: IHttpRequestOptions,
									): Promise<IHttpRequestOptions> {
										const categoryGroupName = String(this.getNodeParameter('categoryGroupName') || '').trim();
										if (!categoryGroupName) {
											throw new NodeOperationError(this.getNode(), 'Category group name is required');
										}
										return {
											...requestOptions,
											body: { category_group: { name: categoryGroupName } },
										};
									},
								],
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: { property: 'data.category_group' },
									},
								],
							},
						},
					},
					{
						name: 'Update Group',
						value: 'updateGroup',
						description: 'Update a category group',
						action: 'Update a category group',
						routing: {
							request: {
								method: 'PATCH',
								url: '=/plans/{{$parameter.planId}}/category_groups/{{$parameter.categoryGroupId}}',
							},
							send: {
								type: 'body',
								property: 'category_group',
								preSend: [
									async function (
										this: IExecuteSingleFunctions,
										requestOptions: IHttpRequestOptions,
									): Promise<IHttpRequestOptions> {
										const categoryGroupName = String(this.getNodeParameter('categoryGroupName') || '').trim();
										if (!categoryGroupName) {
											throw new NodeOperationError(this.getNode(), 'Category group name is required');
										}
										return {
											...requestOptions,
											body: { category_group: { name: categoryGroupName } },
										};
									},
								],
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: { property: 'data.category_group' },
									},
								],
							},
						},
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Plan',
				name: 'planId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['category'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchPlans',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. last-used',
					},
				],
				description: 'Select a plan from the list or enter a plan ID',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				displayOptions: {
					show: {
						resource: ['category'],
						operation: ['getAll'],
					},
				},
				default: {},
				placeholder: 'Add Field',
				options: [
					{
						displayName: 'Last Knowledge of Server',
						name: 'lastKnowledgeOfServer',
						type: 'string',
						default: '',
						description:
							'If provided, only entities changed since this server knowledge value are returned',
						routing: {
							request: {
								qs: {
									last_knowledge_of_server: '={{$value || undefined}}',
								},
							},
						},
					},
				],
			},
			{
				displayName: 'Category Name',
				name: 'categoryName',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['category'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'The name of the category',
			},
			{
				displayName: 'Parent Category Group ID',
				name: 'parentCategoryGroupId',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['category'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'The ID of the parent category group',
			},
			{
				displayName: 'Note',
				name: 'note',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['category'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'The note for the category',
			},
			{
				displayName: 'Goal Target',
				name: 'goalTarget',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['category'],
						operation: ['create', 'update'],
					},
				},
				default: 0,
				description: 'The goal target amount in milliunits format',
			},
			{
				displayName: 'Goal Target Date',
				name: 'goalTargetDate',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['category'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'The goal target date in ISO format (YYYY-MM-DD)',
			},
			{
				displayName: 'Category',
				name: 'categoryId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['category'],
						operation: ['get', 'update', 'getMonth', 'updateMonth'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchCategories',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 00000000-0000-0000-0000-000000000000',
					},
				],
				description: 'Select a category from the selected plan or enter a category ID',
			},
			{
				displayName: 'Month',
				name: 'month',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['category'],
						operation: ['getMonth', 'updateMonth'],
					},
				},
				default: '',
				description: 'The plan month in ISO format (YYYY-MM-DD) or current',
			},
			{
				displayName: 'Budgeted',
				name: 'budgeted',
				type: 'number',
				required: true,
				displayOptions: {
					show: {
						resource: ['category'],
						operation: ['updateMonth'],
					},
				},
				default: 0,
				description: 'Assigned amount in milliunits format',
			},
			{
				displayName: 'Category Group Name',
				name: 'categoryGroupName',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['category'],
						operation: ['createGroup', 'updateGroup'],
					},
				},
				default: '',
				description: 'The name of the category group',
			},
			{
				displayName: 'Category Group ID',
				name: 'categoryGroupId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['category'],
						operation: ['updateGroup'],
					},
				},
				default: '',
				description: 'The ID of the category group',
			},

			// Payee Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['payee'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get many payees',
						action: 'Get many payees',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}/payees',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.payees',
										},
									},
								],
							},
						},
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single payee',
						action: 'Get a payee',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}/payees/{{$parameter.payeeId}}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.payee',
										},
									},
								],
							},
						},
					},
					{
						name: 'Create',
						value: 'create',
						description: 'Create a new payee',
						action: 'Create a payee',
						routing: {
							request: {
								method: 'POST',
								url: '=/plans/{{$parameter.planId}}/payees',
							},
							send: {
								type: 'body',
								property: 'payee',
								preSend: [
									async function (
										this: IExecuteSingleFunctions,
										requestOptions: IHttpRequestOptions,
									): Promise<IHttpRequestOptions> {
										const payeeResourceName = String(
											this.getNodeParameter('payeeResourceName') || '',
										).trim();
										if (!payeeResourceName) {
											throw new NodeOperationError(this.getNode(), 'Payee name is required');
										}

										return {
											...requestOptions,
											body: { payee: { name: payeeResourceName } },
										};
									},
								],
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: { property: 'data.payee' },
									},
								],
							},
						},
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update a payee',
						action: 'Update a payee',
						routing: {
							request: {
								method: 'PATCH',
								url: '=/plans/{{$parameter.planId}}/payees/{{$parameter.payeeId}}',
							},
							send: {
								type: 'body',
								property: 'payee',
								preSend: [
									async function (
										this: IExecuteSingleFunctions,
										requestOptions: IHttpRequestOptions,
									): Promise<IHttpRequestOptions> {
										const payeeResourceName = String(
											this.getNodeParameter('payeeResourceName') || '',
										).trim();
										const payee: IDataObject = {};
										if (payeeResourceName) {
											payee.name = payeeResourceName;
										}

										return {
											...requestOptions,
											body: { payee },
										};
									},
								],
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: { property: 'data.payee' },
									},
								],
							},
						},
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Plan',
				name: 'planId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['payee'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchPlans',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. last-used',
					},
				],
				description: 'Select a plan from the list or enter a plan ID',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				displayOptions: {
					show: {
						resource: ['payee'],
						operation: ['getAll'],
					},
				},
				default: {},
				placeholder: 'Add Field',
				options: [
					{
						displayName: 'Last Knowledge of Server',
						name: 'lastKnowledgeOfServer',
						type: 'string',
						default: '',
						description:
							'If provided, only entities changed since this server knowledge value are returned',
						routing: {
							request: {
								qs: {
									last_knowledge_of_server: '={{$value || undefined}}',
								},
							},
						},
					},
				],
			},
			{
				displayName: 'Payee Name',
				name: 'payeeResourceName',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['payee'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'The name of the payee',
			},
			{
				displayName: 'Payee ID',
				name: 'payeeId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['payee'],
						operation: ['get', 'update'],
					},
				},
				default: '',
				description: 'The ID of the payee',
			},

			// Month Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['month'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get many plan months',
						action: 'Get many plan months',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}/months',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.months',
										},
									},
								],
							},
						},
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single plan month',
						action: 'Get a plan month',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}/months/{{$parameter.month}}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.month',
										},
									},
								],
							},
						},
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Plan',
				name: 'planId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['month'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchPlans',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. last-used',
					},
				],
				description: 'Select a plan from the list or enter a plan ID',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				displayOptions: {
					show: {
						resource: ['month'],
						operation: ['getAll'],
					},
				},
				default: {},
				placeholder: 'Add Field',
				options: [
					{
						displayName: 'Last Knowledge of Server',
						name: 'lastKnowledgeOfServer',
						type: 'string',
						default: '',
						description:
							'If provided, only entities changed since this server knowledge value are returned',
						routing: {
							request: {
								qs: {
									last_knowledge_of_server: '={{$value || undefined}}',
								},
							},
						},
					},
				],
			},
			{
				displayName: 'Month',
				name: 'month',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['month'],
						operation: ['get'],
					},
				},
				default: '',
				description: 'The plan month in ISO format (YYYY-MM-DD) or current',
			},

			// Payee Location Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['payeeLocation'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get many payee locations',
						action: 'Get many payee locations',
						routing: {
							request: {
								method: 'GET',
								url: '={{$parameter.payeeLocationAdditionalFilters && $parameter.payeeLocationAdditionalFilters.payeeId ? "/plans/" + $parameter.planId + "/payees/" + $parameter.payeeLocationAdditionalFilters.payeeId + "/payee_locations" : "/plans/" + $parameter.planId + "/payee_locations"}}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.payee_locations',
										},
									},
								],
							},
						},
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single payee location',
						action: 'Get a payee location',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}/payee_locations/{{$parameter.payeeLocationId}}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.payee_location',
										},
									},
								],
							},
						},
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Plan',
				name: 'planId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['payeeLocation'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchPlans',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. last-used',
					},
				],
				description: 'Select a plan from the list or enter a plan ID',
			},
			{
				displayName: 'Payee Location ID',
				name: 'payeeLocationId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['payeeLocation'],
						operation: ['get'],
					},
				},
				default: '',
				description: 'The ID of the payee location',
			},
			{
				displayName: 'Additional Filters',
				name: 'payeeLocationAdditionalFilters',
				type: 'collection',
				displayOptions: {
					show: {
						resource: ['payeeLocation'],
						operation: ['getAll'],
					},
				},
				default: {},
				placeholder: 'Add Filter',
				options: [
					{
						displayName: 'Payee ID',
						name: 'payeeId',
						type: 'string',
						default: '',
						description: 'If provided, get payee locations only for this payee',
					},
				],
				description: 'Optionally filter to payee locations for a specific payee',
			},
			// Money Movement Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['moneyMovement'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get many money movements',
						action: 'Get many money movements',
						routing: {
							request: {
								method: 'GET',
								url: '={{$parameter.moneyMovementAdditionalFilters && $parameter.moneyMovementAdditionalFilters.month ? "/plans/" + $parameter.planId + "/months/" + $parameter.moneyMovementAdditionalFilters.month + "/money_movements" : "/plans/" + $parameter.planId + "/money_movements"}}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.money_movements',
										},
									},
								],
							},
						},
					},
					{
						name: 'Get All Groups',
						value: 'getGroups',
						description: 'Get all money movement groups',
						action: 'Get all money movement groups',
						routing: {
							request: {
								method: 'GET',
								url: '={{$parameter.moneyMovementAdditionalFilters && $parameter.moneyMovementAdditionalFilters.month ? "/plans/" + $parameter.planId + "/months/" + $parameter.moneyMovementAdditionalFilters.month + "/money_movement_groups" : "/plans/" + $parameter.planId + "/money_movement_groups"}}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.money_movement_groups',
										},
									},
								],
							},
						},
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Plan',
				name: 'planId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['moneyMovement'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchPlans',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. last-used',
					},
				],
				description: 'Select a plan from the list or enter a plan ID',
			},
			{
				displayName: 'Additional Filters',
				name: 'moneyMovementAdditionalFilters',
				type: 'collection',
				displayOptions: {
					show: {
						resource: ['moneyMovement'],
						operation: ['getAll', 'getGroups'],
					},
				},
				default: {},
				placeholder: 'Add Filter',
				options: [
					{
						displayName: 'Month',
						name: 'month',
						type: 'string',
						default: '',
						description: 'If provided, only data for this month (YYYY-MM-DD or current) is returned',
					},
				],
				description: 'Optional filters for money movement queries',
			},

			// Scheduled Transaction Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
					},
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get many scheduled transactions',
						action: 'Get many scheduled transactions',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}/scheduled_transactions',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.scheduled_transactions',
										},
									},
								],
							},
						},
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single scheduled transaction',
						action: 'Get a scheduled transaction',
						routing: {
							request: {
								method: 'GET',
								url: '=/plans/{{$parameter.planId}}/scheduled_transactions/{{$parameter.scheduledTransactionId}}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.scheduled_transaction',
										},
									},
								],
							},
						},
					},
					{
						name: 'Create',
						value: 'create',
						description: 'Create a scheduled transaction',
						action: 'Create a scheduled transaction',
						routing: {
							request: {
								method: 'POST',
								url: '=/plans/{{$parameter.planId}}/scheduled_transactions',
							},
							send: {
								type: 'body',
								property: 'scheduled_transaction',
								preSend: [
									async function (
										this: IExecuteSingleFunctions,
										requestOptions: IHttpRequestOptions,
									): Promise<IHttpRequestOptions> {
										const scheduledAccountId = String(
											this.getNodeParameter('scheduledAccountId') || '',
										).trim();
										const scheduledDate = String(
											this.getNodeParameter('scheduledDate') || '',
										).trim();
										if (!scheduledAccountId) {
											throw new NodeOperationError(this.getNode(), 'Account is required');
										}
										if (!scheduledDate) {
											throw new NodeOperationError(this.getNode(), 'Date is required');
										}

										const scheduledAmount = this.getNodeParameter('scheduledAmount', 0) as number;
										const scheduledPayeeId = String(
											this.getNodeParameter('scheduledPayeeId', ''),
										).trim();
										const scheduledPayeeName = String(
											this.getNodeParameter('scheduledPayeeName', ''),
										).trim();
										const scheduledCategoryId = String(
											this.getNodeParameter('scheduledCategoryId', ''),
										).trim();
										const scheduledMemo = String(
											this.getNodeParameter('scheduledMemo', ''),
										).trim();
										const scheduledFlagColor = String(
											this.getNodeParameter('scheduledFlagColor', ''),
										).trim();
										const scheduledFrequency = String(
											this.getNodeParameter('scheduledFrequency', ''),
										).trim();

										const scheduled_transaction: IDataObject = {
											account_id: scheduledAccountId,
											date: scheduledDate,
										};

										if (Number.isFinite(scheduledAmount)) {
											scheduled_transaction.amount = scheduledAmount;
										}
										if (scheduledPayeeId) {
											scheduled_transaction.payee_id = scheduledPayeeId;
										}
										if (scheduledPayeeName) {
											scheduled_transaction.payee_name = scheduledPayeeName;
										}
										if (scheduledCategoryId) {
											scheduled_transaction.category_id = scheduledCategoryId;
										}
										if (scheduledMemo) {
											scheduled_transaction.memo = scheduledMemo;
										}
										if (scheduledFlagColor) {
											scheduled_transaction.flag_color = scheduledFlagColor;
										}
										if (scheduledFrequency) {
											scheduled_transaction.frequency = scheduledFrequency;
										}

										return {
											...requestOptions,
											body: { scheduled_transaction },
										};
									},
								],
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: { property: 'data.scheduled_transaction' },
									},
								],
							},
						},
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update a scheduled transaction',
						action: 'Update a scheduled transaction',
						routing: {
							request: {
								method: 'PUT',
								url: '=/plans/{{$parameter.planId}}/scheduled_transactions/{{$parameter.scheduledTransactionId}}',
							},
							send: {
								type: 'body',
								property: 'scheduled_transaction',
								preSend: [
									async function (
										this: IExecuteSingleFunctions,
										requestOptions: IHttpRequestOptions,
									): Promise<IHttpRequestOptions> {
										const scheduledAccountId = String(
											this.getNodeParameter('scheduledAccountId') || '',
										).trim();
										const scheduledDate = String(
											this.getNodeParameter('scheduledDate') || '',
										).trim();
										if (!scheduledAccountId) {
											throw new NodeOperationError(this.getNode(), 'Account is required');
										}
										if (!scheduledDate) {
											throw new NodeOperationError(this.getNode(), 'Date is required');
										}

										const scheduledAmount = this.getNodeParameter('scheduledAmount', 0) as number;
										const scheduledPayeeId = String(
											this.getNodeParameter('scheduledPayeeId', ''),
										).trim();
										const scheduledPayeeName = String(
											this.getNodeParameter('scheduledPayeeName', ''),
										).trim();
										const scheduledCategoryId = String(
											this.getNodeParameter('scheduledCategoryId', ''),
										).trim();
										const scheduledMemo = String(
											this.getNodeParameter('scheduledMemo', ''),
										).trim();
										const scheduledFlagColor = String(
											this.getNodeParameter('scheduledFlagColor', ''),
										).trim();
										const scheduledFrequency = String(
											this.getNodeParameter('scheduledFrequency', ''),
										).trim();

										const scheduled_transaction: IDataObject = {
											account_id: scheduledAccountId,
											date: scheduledDate,
										};

										if (Number.isFinite(scheduledAmount)) {
											scheduled_transaction.amount = scheduledAmount;
										}
										if (scheduledPayeeId) {
											scheduled_transaction.payee_id = scheduledPayeeId;
										}
										if (scheduledPayeeName) {
											scheduled_transaction.payee_name = scheduledPayeeName;
										}
										if (scheduledCategoryId) {
											scheduled_transaction.category_id = scheduledCategoryId;
										}
										if (scheduledMemo) {
											scheduled_transaction.memo = scheduledMemo;
										}
										if (scheduledFlagColor) {
											scheduled_transaction.flag_color = scheduledFlagColor;
										}
										if (scheduledFrequency) {
											scheduled_transaction.frequency = scheduledFrequency;
										}

										return {
											...requestOptions,
											body: { scheduled_transaction },
										};
									},
								],
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: { property: 'data.scheduled_transaction' },
									},
								],
							},
						},
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a scheduled transaction',
						action: 'Delete a scheduled transaction',
						routing: {
							request: {
								method: 'DELETE',
								url: '=/plans/{{$parameter.planId}}/scheduled_transactions/{{$parameter.scheduledTransactionId}}',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: { property: 'data.scheduled_transaction' },
									},
								],
							},
						},
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Plan',
				name: 'planId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchPlans',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. last-used',
					},
				],
				description: 'Select a plan from the list or enter a plan ID',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
						operation: ['getAll'],
					},
				},
				default: {},
				placeholder: 'Add Field',
				options: [
					{
						displayName: 'Last Knowledge of Server',
						name: 'lastKnowledgeOfServer',
						type: 'string',
						default: '',
						description:
							'If provided, only entities changed since this server knowledge value are returned',
						routing: {
							request: {
								qs: {
									last_knowledge_of_server: '={{$value || undefined}}',
								},
							},
						},
					},
				],
			},
			{
				displayName: 'Scheduled Transaction ID',
				name: 'scheduledTransactionId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
						operation: ['get', 'update', 'delete'],
					},
				},
				default: '',
				description: 'The ID of the scheduled transaction',
			},
			{
				displayName: 'Account',
				name: 'scheduledAccountId',
				type: 'resourceLocator',
				required: true,
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
						operation: ['create', 'update'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchAccounts',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 00000000-0000-0000-0000-000000000000',
					},
				],
				description: 'Select an account from the selected plan or enter an account ID',
			},
			{
				displayName: 'Date',
				name: 'scheduledDate',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'The scheduled transaction date in ISO format (YYYY-MM-DD)',
			},
			{
				displayName: 'Amount',
				name: 'scheduledAmount',
				type: 'number',
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
						operation: ['create', 'update'],
					},
				},
				default: 0,
				description: 'The scheduled transaction amount in milliunits format',
			},
			{
				displayName: 'Payee ID',
				name: 'scheduledPayeeId',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'The ID of the payee',
			},
			{
				displayName: 'Payee Name',
				name: 'scheduledPayeeName',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'The payee name to use when payee ID is not provided',
			},
			{
				displayName: 'Category',
				name: 'scheduledCategoryId',
				type: 'resourceLocator',
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
						operation: ['create', 'update'],
					},
				},
				default: {
					mode: 'list',
					value: '',
				},
				modes: [
					{
						displayName: 'From List',
						name: 'list',
						type: 'list',
						typeOptions: {
							searchListMethod: 'searchCategories',
							searchable: true,
							searchFilterRequired: false,
						},
					},
					{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 00000000-0000-0000-0000-000000000000',
					},
				],
				description: 'Select a category from the selected plan or enter a category ID',
			},
			{
				displayName: 'Memo',
				name: 'scheduledMemo',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'Scheduled transaction memo',
			},
			{
				displayName: 'Flag Color',
				name: 'scheduledFlagColor',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
						operation: ['create', 'update'],
					},
				},
				options: [
					{ name: 'Blue', value: 'blue' },
					{ name: 'Green', value: 'green' },
					{ name: 'None', value: '' },
					{ name: 'Orange', value: 'orange' },
					{ name: 'Purple', value: 'purple' },
					{ name: 'Red', value: 'red' },
					{ name: 'Yellow', value: 'yellow' },
				],
				default: '',
				description: 'Optional flag color for the scheduled transaction',
			},
			{
				displayName: 'Frequency',
				name: 'scheduledFrequency',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
						operation: ['create', 'update'],
					},
				},
				options: [
					{ name: 'Daily', value: 'daily' },
					{ name: 'Every 3 Months', value: 'every3Months' },
					{ name: 'Every 4 Months', value: 'every4Months' },
					{ name: 'Every 4 Weeks', value: 'every4Weeks' },
					{ name: 'Every Other Month', value: 'everyOtherMonth' },
					{ name: 'Every Other Week', value: 'everyOtherWeek' },
					{ name: 'Every Other Year', value: 'everyOtherYear' },
					{ name: 'Monthly', value: 'monthly' },
					{ name: 'Never', value: 'never' },
					{ name: 'None', value: '' },
					{ name: 'Twice A Month', value: 'twiceAMonth' },
					{ name: 'Twice A Year', value: 'twiceAYear' },
					{ name: 'Weekly', value: 'weekly' },
					{ name: 'Yearly', value: 'yearly' },
				],
				default: '',
				description: 'Optional recurrence frequency for the scheduled transaction',
			},

			// User Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['user'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get authenticated user information',
						action: 'Get user info',
						routing: {
							request: {
								method: 'GET',
								url: '/user',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data.user',
										},
									},
								],
							},
						},
					},
				],
				default: 'get',
			},
		],
	};

	methods = {
		listSearch: {
			async searchPlans(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const scope = await Ynab.getCacheScope(this);
				const cacheKey = scope ? `${scope}:plans` : null;
				let plans = Ynab.readLocatorCache(cacheKey);

				if (!plans) {
					const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'ynabApi', {
						url: 'https://api.ynab.com/v1/plans',
						method: 'GET',
						json: true,
					})) as IDataObject;

					plans = ((((response.data as IDataObject)?.plans as IDataObject[]) || [])
						.filter((plan) => typeof plan.id === 'string')
						.map((plan) => ({
							id: String(plan.id),
							name: String(plan.name || plan.id),
						})));

					Ynab.writeLocatorCache(cacheKey, plans);
				}

				const normalizedFilter = (filter || '').toLowerCase();

				const results: INodeListSearchItems[] = plans
					.filter((plan) => {
						if (!normalizedFilter) return true;
						const name = plan.name.toLowerCase();
						const id = plan.id.toLowerCase();
						return name.includes(normalizedFilter) || id.includes(normalizedFilter);
					})
					.map((plan) => ({
						name: plan.name,
						value: plan.id,
					}));

				return { results };
			},
			async searchAccounts(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				let planId = '';
				try {
					planId = Ynab.getLocatorValue(this.getNodeParameter('planId', ''));
				} catch {
					return { results: [] };
				}

				if (!planId) {
					return { results: [] };
				}

				const scope = await Ynab.getCacheScope(this);
				const cacheKey = scope ? `${scope}:accounts:${planId}` : null;
				let accounts = Ynab.readLocatorCache(cacheKey);

				if (!accounts) {
					const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'ynabApi', {
						url: `https://api.ynab.com/v1/plans/${planId}/accounts`,
						method: 'GET',
						json: true,
					})) as IDataObject;

					accounts = ((((response.data as IDataObject)?.accounts as IDataObject[]) || [])
						.filter((account) => typeof account.id === 'string')
						.map((account) => ({
							id: String(account.id),
							name: String(account.name || account.id),
						})));

					Ynab.writeLocatorCache(cacheKey, accounts);
				}

				const normalizedFilter = (filter || '').toLowerCase();

				const results: INodeListSearchItems[] = accounts
					.filter((account) => {
						if (!normalizedFilter) return true;
						const name = account.name.toLowerCase();
						const id = account.id.toLowerCase();
						return name.includes(normalizedFilter) || id.includes(normalizedFilter);
					})
					.map((account) => ({
						name: account.name,
						value: account.id,
					}));

				return { results };
			},
			async searchCategories(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				let planId = '';
				try {
					planId = Ynab.getLocatorValue(this.getNodeParameter('planId', ''));
				} catch {
					return { results: [] };
				}

				if (!planId) {
					return { results: [] };
				}

				const scope = await Ynab.getCacheScope(this);
				const cacheKey = scope ? `${scope}:categories:${planId}` : null;
				let categories = Ynab.readLocatorCache(cacheKey);

				if (!categories) {
					const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'ynabApi', {
						url: `https://api.ynab.com/v1/plans/${planId}/categories`,
						method: 'GET',
						json: true,
					})) as IDataObject;

					const categoryGroups =
						(((response.data as IDataObject)?.category_groups as IDataObject[]) || []).filter(
							(group) => group && typeof group === 'object',
						);

					const collected: LocatorItem[] = [];

					for (const group of categoryGroups) {
						const groupName = String(group.name || '').trim();
						const groupCategories = ((group.categories as IDataObject[]) || []).filter(
							(category) => typeof category.id === 'string' && category.deleted !== true,
						);

						for (const category of groupCategories) {
							const categoryName = String(category.name || category.id).trim();
							collected.push({
								id: String(category.id),
								name: groupName ? `${groupName} / ${categoryName}` : categoryName,
							});
						}
					}

					categories = collected;
					Ynab.writeLocatorCache(cacheKey, categories);
				}

				const normalizedFilter = (filter || '').toLowerCase();
				const results: INodeListSearchItems[] = categories
					.filter((category) => {
						if (!normalizedFilter) return true;
						return (
							category.name.toLowerCase().includes(normalizedFilter) ||
							category.id.toLowerCase().includes(normalizedFilter)
						);
					})
					.map((category) => ({
						name: category.name,
						value: category.id,
					}));

				return { results };
			},
		},
	};
}