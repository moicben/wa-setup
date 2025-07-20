 
module.exports = {
  linterOptions: {
    reportUnusedDisableDirectives: 'warn'
  },
  languageOptions: {
    globals: {
      node: true
    }
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-console': 'off'
  }
}; 