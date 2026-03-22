const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/content_script.ts', // Your TypeScript entry point
  output: {
    filename: 'content_script.js', // Output bundled file
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
};
