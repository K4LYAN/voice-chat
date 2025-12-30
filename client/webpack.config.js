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
                    use: [
                        'style-loader',
                        'css-loader',
                        'postcss-loader'
                    ]
                },
                {
                    test: /\.(png|jpe?g|gif|svg)$/i,
                    type: 'asset/resource'
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
                chunks: 'all',
                cacheGroups: {
                    // Separate TensorFlow.js into its own chunk
                    tensorflow: {
                        test: /[\\/]node_modules[\\/]@tensorflow[\\/]/,
                        priority: 20,
                        reuseExistingChunk: true,
                    },
                    // Separate NSFWJS into its own chunk
                    nsfwjs: {
                        test: /[\\/]node_modules[\\/]nsfwjs[\\/]/,
                        priority: 20,
                        reuseExistingChunk: true,
                    },
                    // Other vendor code
                    vendors: {
                        test: /[\\/]node_modules[\\/]/,
                        priority: 10,
                        reuseExistingChunk: true,
                    },
                },
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
            hints: isProduction ? 'warning' : false,
            maxEntrypointSize: 800000,  // 800 KB - realistic for app without ML
            maxAssetSize: 6000000  // 6 MB - allow ML libraries as separate chunks
        }
    };
};
