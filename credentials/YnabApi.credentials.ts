import {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class YnabApi implements ICredentialType {
	name = 'ynabApi';
	displayName = 'YNAB API';
	icon: Icon = { light: 'file:../icons/ynab.svg', dark: 'file:../icons/ynab.dark.svg' };
	documentationUrl = 'https://api.ynab.com';
	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your YNAB Personal Access Token',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.ynab.com/v1',
			url: '/user',
		},
	};
}