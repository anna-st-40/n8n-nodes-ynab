import {
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IExecuteFunctions,
	IExecuteSingleFunctions,
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
				displayName: 'Plan ID',
				name: 'planId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['plan'],
						operation: ['get', 'getSettings'],
					},
				},
				default: '',
				description: 'The ID of the plan',
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
				displayName: 'Plan ID',
				name: 'planId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['account'],
					},
				},
				default: '',
				description: 'The ID of the plan',
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
								url: '=/plans/{{$parameter.planId}}/transactions',
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
				],
				default: 'getAll',
			},
			{
				displayName: 'Plan ID',
				name: 'planId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['transaction'],
					},
				},
				default: '',
				description: 'The ID of the plan',
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
				],
				default: 'getAll',
			},
			{
				displayName: 'Plan ID',
				name: 'planId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['category'],
					},
				},
				default: '',
				description: 'The ID of the plan',
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
				displayName: 'Category ID',
				name: 'categoryId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['category'],
						operation: ['get'],
					},
				},
				default: '',
				description: 'The ID of the category',
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
				],
				default: 'getAll',
			},
			{
				displayName: 'Plan ID',
				name: 'planId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['payee'],
					},
				},
				default: '',
				description: 'The ID of the plan',
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
				displayName: 'Payee ID',
				name: 'payeeId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['payee'],
						operation: ['get'],
					},
				},
				default: '',
				description: 'The ID of the payee',
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
}