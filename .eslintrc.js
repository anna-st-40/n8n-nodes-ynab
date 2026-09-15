module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: 'module',
	},
	plugins: ['n8n-nodes-base'],
	extends: ['plugin:n8n-nodes-base/community'],
};