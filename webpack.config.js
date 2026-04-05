const path = require("path");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
    mode: "production",
    target: "web",
    entry: "./src/index.js",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "build.js",
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: [["@babel/preset-env", { modules: "commonjs" }]],
                    },
                },
            },
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, "css-loader"],
            },
        ],
    },
    resolve: {
        extensions: [".js"],
        alias: {
            // in-DOM テンプレート用にランタイムコンパイラ入りビルドを使う
            "vue$": "vue/dist/vue.esm-bundler.js",
        },
        fallback: {
            fs: false,
            https: false,
            os: false,
            path: false,
        },
    },
    plugins: [
        new MiniCssExtractPlugin({ filename: "build.css" }),
        // node: プレフィックスを除去して fallback で処理させる
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
            resource.request = resource.request.replace(/^node:/, "");
        }),
        // jQuery をグローバルとして自動注入 (jQuery 4 は ESM なので default を指定)
        new webpack.ProvidePlugin({
            $: ["jquery", "default"],
            jQuery: ["jquery", "default"],
        }),
        // Vue 3 のフィーチャーフラグ
        new webpack.DefinePlugin({
            __VUE_OPTIONS_API__: true,
            __VUE_PROD_DEVTOOLS__: false,
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        }),
    ],
};
