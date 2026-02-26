const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  entry: './src/renderer/index-debug.tsx',
  target: 'electron-renderer',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader',
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/main': path.resolve(__dirname, 'src/main'),
      '@/renderer': path.resolve(__dirname, 'src/renderer'),
      '@/shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  output: {
    filename: 'renderer.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html',
      filename: 'index.html',
    }),
    new webpack.DefinePlugin({
      'global': 'globalThis',
    }),
  ],
  externals: {
    'sqlite3': 'commonjs sqlite3',
    'electron': 'commonjs electron',
  },
  devServer: {
    port: 3000,
    historyApiFallback: true,
    compress: true,
    hot: true,
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    devMiddleware: {
      writeToDisk: true,
    },
  },
};