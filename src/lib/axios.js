const $http = async function (url, method = "GET", body = null) {
    let options = {
        method: method,
    };
    if (body) {
        if (body instanceof FormData) {
            options.body = body;
        } else {
            options.body = JSON.stringify(body);
            options.headers = {
                "Content-Type": "application/json",
            };
        }
    }
    let response = await fetch(url, options);

    if (response.status != 200) {
        throw new Error("HTTP status: " + response.status);
    }
    return response;
};

export { $http };

export function parseURL(baseURL, rawURL) {
    if (rawURL.slice(0, 5) == "data:") {
    } else {
        const url = new URL(rawURL, baseURL);
        return url.href;
    }
    return rawURL;
}