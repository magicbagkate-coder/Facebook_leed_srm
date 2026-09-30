import js from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

const UTILITY_TYPES = 'Partial|Required|Readonly|Pick|Omit';
const BANNED_TYPES = 'Record|Exclude|Extract|Awaited|ReturnType|NonNullable|Parameters|InstanceType';

const typeRules = [
  {
    selector: 'ExportDefaultDeclaration',
    message: 'Default export is forbidden. Use a named export.',
  },
  {
    selector: `TSTypeReference[typeName.name=/^(${BANNED_TYPES})$/]`,
    message: 'This utility type is forbidden. Write an explicit type.',
  },
  {
    selector: `TSTypeReference[typeName.name=/^(${UTILITY_TYPES})$/] TSTypeReference[typeName.name=/^(${UTILITY_TYPES})$/]`,
    message: 'Only one layer of one utility type is allowed. Name an intermediate type.',
  },
  { selector: 'TSConditionalType', message: 'Conditional types are forbidden.' },
  { selector: 'TSMappedType', message: 'Mapped types are forbidden.' },
  { selector: 'TSTemplateLiteralType', message: 'Template literal types are forbidden.' },
  { selector: 'TSIntersectionType', message: 'Intersection types are forbidden. Write one explicit type.' },
];

const styleRules = [
  {
    selector: 'IfStatement[alternate]',
    message: 'else is forbidden. Use an early return.',
  },
  {
    selector: "CallExpression[callee.property.name='then']",
    message: 'Use async/await instead of .then chains.',
  },
  {
    selector: 'SwitchStatement[cases.length>10]',
    message: 'More than 10 cases. Use a Map or a strategy file.',
  },
];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      // Complexity (max 4 branches per function, base path counts as 1)
      complexity: ['error', 5],
      'max-depth': ['error', 3],
      'max-params': ['error', 3],
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      curly: ['error', 'multi-line'],
      eqeqeq: 'error',
      'prefer-const': 'error',
      'no-console': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      'id-denylist': ['error', 'handler', 'handle', 'process', 'data', 'temp'],

      // TypeScript
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'import', format: null },
        { selector: 'objectLiteralProperty', format: null },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
      ],
      'no-restricted-syntax': ['error', ...typeRules, ...styleRules],

      // Aliases and env
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['../*', './*'], message: 'Use the #/ alias instead of relative imports.' }] },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Read env only in src/config via appConfig.' },
      ],

      // Import order: packages, then #/ alias
      'simple-import-sort/imports': ['error', { groups: [['^\\u0000'], ['^@?\\w'], ['^#/']] }],
      'simple-import-sort/exports': 'error',
    },
  },
  {
    files: ['src/config/**/*.ts'],
    rules: { 'no-restricted-properties': 'off', 'id-denylist': 'off' },
  },
  {
    files: ['src/**/*.spec.ts'],
    rules: { 'max-lines': 'off' },
  },
  {
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: { globals: { process: 'readonly', module: 'writable' } },
    rules: { 'no-restricted-syntax': 'off' },
  },
);
