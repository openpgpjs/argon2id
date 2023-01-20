// const path = require('path');

export default {
  mode: 'production',
  entry: './extra-browser.js',
  output: {
      // globalObject: 'this',
      // path: path.resolve(__dirname, 'dist'),
      // publicPath: 'dist/',
      filename: 'extra-browser.bundle.js',
  },
  module: {
      noParse: /\.wasm$/,
      rules: [
          {
              test: /\.wasm$/,
              loader: 'base64-loader',
              type: 'javascript/auto',
          },
      ],
  },
  resolve: {
      fallback: {
          Buffer: false,
      },
  },
};