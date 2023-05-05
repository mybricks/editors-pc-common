const webpack = require("webpack");
const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");


module.exports = {
  mode: "production",
  entry: {
    index: './src/index.tsx'
  },
  output: {
    path: path.resolve(__dirname, "../lib"),
    filename: '[name].js',
    libraryTarget: "umd",
  },
  externals: [
    {
      react: "react",
      "react-dom": "react-dom",
      "@mybricks/rxui": "@mybricks/rxui",
      "@ant-design/icons": "@ant-design/icons",
      antd: "antd"
    },
  ],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                '@babel/preset-react'
              ],
              plugins: [
                ['@babel/plugin-proposal-class-properties', { 'loose': true }],
                ['@babel/plugin-proposal-private-methods', { 'loose': true }],
                [
                  '@babel/plugin-proposal-private-property-in-object',
                  { loose: true }
                ]
              ],
            }
          },
          {
            loader: 'ts-loader',
            options: {
              silent: true,
              transpileOnly: true,
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.less$/i,
        use: [
          { loader: 'style-loader' },
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[local]_[hash:base64:5]',
              },
            },
          },
          {
            loader: 'less-loader',
            options: {
              lessOptions: {
                javascriptEnabled: true,
              },
            },
          },
        ],
      },
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                '@babel/preset-react'
              ],
            }
          },
          {
            loader: '@svgr/webpack',
            options: {
              babel: false,
              icon: true,
            },
          },
        ],
      },
      {
        test: /\.d.ts$/i,
        use: [{ loader: 'raw-loader' }],
      },
    ],
  },
  optimization: {
    concatenateModules: false,
  },
  plugins: [
    new CleanWebpackPlugin({
      protectWebpackAssets: false,
      cleanAfterEveryBuildPatterns: ['*.LICENSE.txt', '*.html'],
    }),
    new BundleAnalyzerPlugin({
      analyzerMode: "static",
    }),
    new webpack.DefinePlugin({
      'process.env': JSON.stringify({})
    })
  ],
}