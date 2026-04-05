import { STATE } from "./constant.js";
import { $http, parseURL } from "./axios.js";

const htmlAnalyzer = {
    getDOM: async function (baseUrl) {
        let url = "/image-scraping/api/Proxy.php?url=" + baseUrl;

        const response = await $http(url);

        let html = await response.text();
        let dom = new DOMParser().parseFromString(html, "text/html");

        return dom;
    },
    getImagesByImgTag: function (baseUrl, dom) {
        let imgs = $("img", dom);

        const img_urls = Array.from(imgs).map((e, i) => {
            let tmp = {
                src: parseURL(baseUrl, e.getAttribute("src")),
                state: STATE.UNACQUIRED,
                referer: baseUrl,
                blocking: true,
            };
            return tmp;
        });

        return img_urls;
    },
    getImagesByFancyBox: function (baseUrl, dom) {
        let scriptTags = $("script", dom), img_urls = [];

        scriptTags.each((i, e) => {
            let script = e.innerText;

            // replaceAllに対応してないversionの別処理
            if (script.replaceAll === undefined) {
                script = script.replace(/(\r\n|\n|\r)/gm, "").replace(/ /g, "").replace(/\t/g, "");
            } else {
                script = script.replaceAll(/(\r\n|\n|\r)/gm, "").replaceAll(" ", "").replaceAll("\t", "");
            }

            if (script.includes("fancybox.open")) {
                let aryStartPos = script.indexOf("$.revo_fancybox.open([") + 22;
                if (aryStartPos == 21) {
                    aryStartPos = script.indexOf("$.fancybox.open([") + 17;
                };
                const aryEndPos = script.indexOf("]", aryStartPos);
                let aryString;
                // replaceAllに対応してないversionの別処理
                if (script.replaceAll === undefined) {
                    aryString = "[" + script.slice(aryStartPos, aryEndPos).replace(/href/g, "\"href\"") + "]";
                } else {
                    aryString = "[" + script.slice(aryStartPos, aryEndPos).replaceAll("href", "\"href\"") + "]";
                }

                let ary = (new Function("return " + aryString))();

                ary.forEach(img => {
                    img_urls.push({
                        src: parseURL(baseUrl, img.href),
                        state: STATE.UNACQUIRED,
                        blocking: true,
                        referer: baseUrl,
                    });
                });
            }
        });

        return img_urls;
    },
};

export default htmlAnalyzer;