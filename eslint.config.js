import js from '@eslint/js'
import globals from 'globals'

export default [
	js.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.node
			},
			ecmaVersion: 'latest',
			sourceType: 'module'
		},
		rules: {
			'no-console': 'off',
			'quotes': ['error', 'single'],
			'semi': ['error', 'never'],

			'no-unused-vars': ['warn', {
				//'argsIgnorePattern': '^_',
				//'varsIgnorePattern': '^_',
				//'caughtErrorsIgnorePattern': '^_'
			}]
		}
	},
	{
		ignores: ['node_modules/', 'static/']
	}
]
