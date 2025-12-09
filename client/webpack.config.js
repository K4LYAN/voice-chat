const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');

module.exports = {
    entry: './src/main.jsx',
    output: {
        path: path.join(__dirname, '/dist'),
        filename: 'bundle.js',
        publicPath: '/'
    },
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env', '@babel/preset-react']
                    }
                }
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './index.html'
        }),
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer']
        }),
        new Dotenv({
            systemvars: true // Allow system env vars (for Vercel)
        })
    ],
    resolve: {
        extensions: ['.js', '.jsx'],
        fallback: {
            "process": require.resolve("process/browser"),
            "buffer": require.resolve("buffer/")
        }
    },
    devServer: {
        host: '0.0.0.0',
        allowedHosts: 'all',
        port: 5173,
        historyApiFallback: true,
        hot: true,
        open: true
    }
};
