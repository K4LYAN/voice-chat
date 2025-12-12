const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');

// Try/catch for analyzer in case it's not installed yet (though we update package.json)
let BundleAnalyzerPlugin;
try {
    BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
} catch (e) {
    BundleAnalyzerPlugin = null;
}

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';
    const isAnalyze = process.env.ANALYZE === 'true';

    return {
        entry: './src/main.jsx',
        output: {
            path: path.join(__dirname, '/dist'),
            filename: '[name].[contenthash].js', // Use contenthash for caching
            publicPath: '/',
            clean: true // Clean the output directory before emit
        },
        devtool: isProduction ? false : 'inline-source-map', // Disable source maps in production
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
            }),
            (isAnalyze && BundleAnalyzerPlugin) && new BundleAnalyzerPlugin({
                analyzerMode: 'static',
                openAnalyzer: false,
            })
        ].filter(Boolean),
        resolve: {
            extensions: ['.js', '.jsx'],
            fallback: {
                "process": require.resolve("process/browser"),
                "buffer": require.resolve("buffer/")
            }
        },
        optimization: {
            splitChunks: {
                chunks: 'all', // Split all chunks (async and initial)
            },
        },
        devServer: {
            host: '0.0.0.0',
            allowedHosts: 'all',
            port: 5173,
            historyApiFallback: true,
            hot: true,
            open: false // Do not open browser automatically
        },
        performance: {
            hints: isProduction ? 'warning' : false, // Disable hints in dev
            maxEntrypointSize: 512000,
            maxAssetSize: 512000
        }
    };
};
