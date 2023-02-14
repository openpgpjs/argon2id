module.exports = {
  "extends": [
      "eslint:recommended"
  ],

  "parser": "@typescript-eslint/parser",
  "parserOptions": {
      "ecmaVersion": 9,
      "sourceType": "module"
  },

  "globals": {
      "btoa": "readonly",
      "atob": "readonly",
      "globalThis": "readonly"
  },
  "env": {
      "es6": true,
      "browser": true,
      "node": true,
      "mocha": true
  },
  "plugins": [
      "@typescript-eslint",
      "import"
  ],
  "rules": {
      "no-unused-vars": ["error", {"args": "none"}],
      "prefer-spread": "off",
      "no-restricted-syntax": "off",
      "consistent-return": "off",
      "object-curly-newline": "off",
      "prefer-template": "off",
      "no-plusplus": "off",
      "no-continue": "off",
      "no-bitwise": "off",
      "no-await-in-loop": "off",
      "no-sequences": "warn",
      "no-param-reassign": "warn",
      "no-return-assign": "warn",
      "no-else-return": ["error", { "allowElseIf": true }],
      "no-shadow": "off",
      "no-undef": "error",
      "arrow-body-style": "off",
      "space-before-function-paren": "off",
      "operator-linebreak": "off",
      "implicit-arrow-linebreak": "off",
      "no-underscore-dangle": "off",
      "import/no-unresolved": ["error", {
          "ignore": ["^react$", "ttag", ".data"]
      }],
      "import/prefer-default-export": "off",
      "import/no-extraneous-dependencies": "off",
      "import/no-unassigned-import": "error",
      "import/named": "error",
      "max-len": ["error", {
          "ignoreComments": true,
          "code": 130,
          "ignoreStrings": true,
          "ignoreTemplateLiterals": true,
          "ignoreRegExpLiterals": true
      }],
      "no-multiple-empty-lines": ["error"],
      "no-trailing-spaces": ["error"],
      "eol-last": ["error"],
      "padded-blocks": "off",
      "max-classes-per-file": "off",
      "no-empty": "off"
  }
}
