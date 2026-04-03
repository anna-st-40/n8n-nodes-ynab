import {
	NodeOperationError,
	INodeType,
	INodeTypeDescription,
	INodeListSearchItems,
	INodeListSearchResult,
	INodeExecutionData,
	IExecuteFunctions,
	IExecuteSingleFunctions,
	ILoadOptionsFunctions,
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';

export class Ynab implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'YNAB',
		name: 'ynab',
		icon: 'file:ynab.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with YNAB (You Need A Budget) API',
		defaults: {
			name: 'YNAB',
		},
		inputs: ['main'],
		outputs: ['main'],
		// @ts-ignore - usableAsTool is not in the type definition yet but is supported
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
						name: 'Plan',
						value: 'plan',
					},
					{
						name: 'Account',
						value: 'account',
					},
					{
						name: 'Category',
						value: 'category',
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
						name: 'Month',
						value: 'month',
					},
					{
						name: 'Money Movement',
						value: 'moneyMovement',
					},
					{
						name: 'Transaction',
						value: 'transaction',
					},
					{
						name: 'Scheduled Transaction',
						value: 'scheduledTransaction',
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
						name: 'Get All',
						value: 'getAll',
						description: 'Get all plans',
						action: 'Get all plans',
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
						name: 'Get All',
						value: 'getAll',
						description: 'Get all accounts for a plan',
						action: 'Get all accounts',
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
				default: '',
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
				displayName: 'Account ID',
				name: 'accountId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['account'],
						operation: ['get'],
					},
				},
				default: '',
				description: 'The ID of the account',
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
					{ name: 'Checking', value: 'checking' },
					{ name: 'Savings', value: 'savings' },
					{ name: 'Credit Card', value: 'creditCard' },
					{ name: 'Cash', value: 'cash' },
					{ name: 'Line of Credit', value: 'lineOfCredit' },
					{ name: 'Other Asset', value: 'otherAsset' },
					{ name: 'Other Liability', value: 'otherLiability' },
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
						name: 'Get All',
						value: 'getAll',
						description: 'Get all transactions',
						action: 'Get all transactions',
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
						name: 'Plan',
						value: 'plan',
						description: 'Return all plan transactions',
					},
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
						name: 'Payee',
						value: 'payee',
						description: 'Return transactions for a single payee',
					},
					{
						name: 'Month',
						value: 'month',
						description: 'Return transactions for a specific month',
					},
				],
				default: 'plan',
				description:
					'Select which transactions endpoint to query. Plan is the default and returns all non-pending transactions for the plan. The other scopes require a target ID or month and map to the account, category, payee, or month-specific list endpoints from the API.',
			},
			{
				displayName: 'Account ID',
				name: 'transactionAccountId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['getAll'],
						transactionListScope: ['account'],
					},
				},
				default: '',
				description: 'The ID of the account',
			},
			{
				displayName: 'Category ID',
				name: 'transactionCategoryId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['getAll'],
						transactionListScope: ['category'],
					},
				},
				default: '',
				description: 'The ID of the category',
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
				default: '',
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
				placeholder: '[{"id":"...","amount":12345}]',
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
				displayName: 'Account ID',
				name: 'accountId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'The ID of the account',
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
						name: 'Get All',
						value: 'getAll',
						description: 'Get all categories',
						action: 'Get all categories',
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
				default: '',
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
				displayName: 'Category ID',
				name: 'categoryId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['category'],
						operation: ['get', 'update', 'getMonth', 'updateMonth'],
					},
				},
				default: '',
				description: 'The ID of the category',
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
						name: 'Get All',
						value: 'getAll',
						description: 'Get all payees',
						action: 'Get all payees',
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
				default: '',
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
						name: 'Get All',
						value: 'getAll',
						description: 'Get all plan months',
						action: 'Get all plan months',
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
				default: '',
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
						name: 'Get All',
						value: 'getAll',
						description: 'Get all payee locations',
						action: 'Get all payee locations',
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
				default: '',
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
						name: 'Get All',
						value: 'getAll',
						description: 'Get all money movements',
						action: 'Get all money movements',
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
				default: '',
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
						name: 'Get All',
						value: 'getAll',
						description: 'Get all scheduled transactions',
						action: 'Get all scheduled transactions',
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
											throw new NodeOperationError(this.getNode(), 'Account ID is required');
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
											throw new NodeOperationError(this.getNode(), 'Account ID is required');
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
				default: '',
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
				displayName: 'Account ID',
				name: 'scheduledAccountId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'The ID of the account',
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
				displayName: 'Category ID',
				name: 'scheduledCategoryId',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['scheduledTransaction'],
						operation: ['create', 'update'],
					},
				},
				default: '',
				description: 'The ID of the category',
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
					{ name: 'None', value: '' },
					{ name: 'Red', value: 'red' },
					{ name: 'Orange', value: 'orange' },
					{ name: 'Yellow', value: 'yellow' },
					{ name: 'Green', value: 'green' },
					{ name: 'Blue', value: 'blue' },
					{ name: 'Purple', value: 'purple' },
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
					{ name: 'None', value: '' },
					{ name: 'Never', value: 'never' },
					{ name: 'Daily', value: 'daily' },
					{ name: 'Weekly', value: 'weekly' },
					{ name: 'Every Other Week', value: 'everyOtherWeek' },
					{ name: 'Twice A Month', value: 'twiceAMonth' },
					{ name: 'Every 4 Weeks', value: 'every4Weeks' },
					{ name: 'Monthly', value: 'monthly' },
					{ name: 'Every Other Month', value: 'everyOtherMonth' },
					{ name: 'Every 3 Months', value: 'every3Months' },
					{ name: 'Every 4 Months', value: 'every4Months' },
					{ name: 'Twice A Year', value: 'twiceAYear' },
					{ name: 'Yearly', value: 'yearly' },
					{ name: 'Every Other Year', value: 'everyOtherYear' },
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
				const response = (await this.helpers.requestWithAuthentication.call(this, 'ynabApi', {
					url: 'https://api.ynab.com/v1/plans',
					method: 'GET',
					json: true,
				})) as IDataObject;

				const plans = (((response.data as IDataObject)?.plans as IDataObject[]) || []).filter(
					(plan) => typeof plan.id === 'string',
				);
				const normalizedFilter = (filter || '').toLowerCase();

				const results: INodeListSearchItems[] = plans
					.filter((plan) => {
						if (!normalizedFilter) return true;
						const name = String(plan.name || '').toLowerCase();
						const id = String(plan.id || '').toLowerCase();
						return name.includes(normalizedFilter) || id.includes(normalizedFilter);
					})
					.map((plan) => ({
						name: String(plan.name || plan.id),
						value: String(plan.id),
					}));

				return { results };
			},
		},
	};
}