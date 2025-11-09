const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

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
      watch: {
        ignored: /node_modules/,
        poll: false
      }
    },
    hot: true,
    liveReload: true,  // Enable live reload for code changes
    watchFiles: {
      paths: ['src/**/*.ts', 'assets/**/*', 'styles.css', 'index.html'],
      options: {
        ignored: /node_modules/,
        usePolling: false,
        aggregateTimeout: 500,  // Wait 500ms after last change before reloading (prevents false triggers)
        poll: false
      }
    }
  },
  watchOptions: {
    ignored: /node_modules/,
    aggregateTimeout: 500,  // Debounce file changes to prevent rapid rebuilds
    poll: false
  }
}
