const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const webpack = require('webpack')
const packageJson = require('./package.json')

module.exports = {
  entry: './src/index.ts',
  output: {
    // filename: '[name].[contenthash].js',
    filename: '[name].js',
    path: path.resolve(__dirname, 'build'),
    clean: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'index.html'),
      inject: 'body'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'assets', to: 'assets' },
        { from: 'styles.css', to: 'styles.css' }
      ]
    }),
    new webpack.DefinePlugin({
      'process.env.API_BASE_URL': JSON.stringify(process.env.API_BASE_URL || '/api'),
      'APP_VERSION': JSON.stringify(packageJson.version)
    })
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json']
  },
  optimization: {
    splitChunks: {
      chunks: 'all'
    }
  },
  devServer: {
    port: 8000,
    static: {
      directory: path.join(__dirname, '.'),
      watch: true
    }
  }
}
