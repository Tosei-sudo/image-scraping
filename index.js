
const STATE = {
    READY: 0,
    UNACQUIRED: 1,
    OBTAINING: 2,
    OBTAINED: 3,
    SAVED: 4,
    FAILED: 5,
    LOADING: 99,
};

// promise allSettledのポリフィル
if (!Promise.allSettled) {
    Promise.allSettled = function (promises) {
        return Promise.all(promises.map(promise =>
            promise
                .then(value => ({ status: "fulfilled", value }))
                .catch(reason => ({ status: "rejected", reason }))
        ));
    };
}

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

const utilsLogic = {
    parseURL: function (baseURL, rawURL) {
        if (rawURL.slice(0, 5) == "data:") {
        } else {
            const url = new URL(rawURL, baseURL);
            return url.href;
        }
        return rawURL;
    },
};

const htmlLogic = {
    getDOM: async function (baseUrl) {
        let url = "/image-scraping/api/Proxy.php?url=" + baseUrl;

        const response = await $http(url);

        let html = await response.text();
        let dom = new DOMParser().parseFromString(html, "text/html");

        return dom;
    },
    getImagesByImgTag: function (baseUrl, dom) {
        let imgs = $("img", dom), img_urls = [];

        imgs.each((i, e) => {
            let tmp = {
                src: utilsLogic.parseURL(baseUrl, e.getAttribute("src")),
                state: STATE.UNACQUIRED,
                referer: baseUrl,
            };
            // igonor not png or jpg
            if (!tmp.src.match(/\.(png|jpg)$/)) {
                return;
            }
            img_urls.push(tmp);
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
                        src: utilsLogic.parseURL(baseUrl, img.href),
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

const imageLogic = {
    getImagesData: async function (images, projectCode) {
        let tasks = [], group = [];
        // 各画像の取得処理を非同期で実行。ただし、負荷分散のため3つずつまとめて実行
        for (let index = 0; index < images.length; index++) {
            const image = images[index];
            if (!image.blocking) {
                tasks.push(this.getImage(image, projectCode));
            } else {
                group.push(this.getImage(image, projectCode));
            }
            if (group.length == 3 || index == images.length - 1) {
                await Promise.allSettled(group);
                group = [];
            }
        }
        await Promise.allSettled(tasks);
    },
    getImage: async function (image, projectCode) {
        try {
            image.state = STATE.OBTAINING;

            let file;
            if (image.src.slice(0, 5) == "data:") {
                file = this.getImageByDataURL(image.src)
            } else {
                file = await this.getImageByURL(image);
            }

            image.state = STATE.OBTAINED;

            await this.saveImage(file, projectCode);

            image.state = STATE.SAVED;
        } catch (error) {
            image.state = STATE.FAILED;
        }
    },
    getImageByDataURL: function (dataUrl) {
        // Data URLスキームを解析してデータ部分を抽出

        let commaIndex = dataUrl.indexOf(',');
        let base64String = dataUrl.slice(commaIndex + 1);
        let extention = dataUrl.slice(11, commaIndex).split(';')[0];

        // Base64デコードを行い、バイナリデータに変換
        let data = new Uint8Array(atob(base64String).split('').map(c => c.charCodeAt(0))).buffer;

        let fName = "dataURL_" + Math.random().toString(32).substring(2) + "." + extention;

        return new File([data], fName);
    },
    getImageByURL: async function (image) {
        const response = await $http(
            `/image-scraping/api/Proxy.php?&url=${image.src}&referer=${image.referer}`,
        );
        let data = await response.blob();
        // if start with HTTP/1.1 then split by space and get the last part
        let fName = image.src.split("/").pop().replace(/\?/, "_");

        let tmp = await data.text();
        if (tmp.startsWith("HTTP/1.1")) {
            let dataStartPos = tmp.indexOf("\r\n\r\n") + 4;
            data = data.slice(dataStartPos);
            fName = fName + ".jpg";
        }

        return new File([data], fName);
    },
    saveImage: async function (file, projectCode) {
        let formData = new FormData();

        formData.append("image", file);
        formData.append("projectCode", projectCode);
        formData.append("fileName", file.name);

        await $http("/image-scraping/api/SaveImage.php", "POST", formData);
    },
};

window.onload = () => {
    Vue.createApp({
        data() {
            return {
                tmpUrl: "",
                images: [],
                projectCode: "",
                state: STATE.READY,
                autoRetry: true,
            };
        },
        computed: {
            retryFlag() {
                if (this.state != STATE.SAVED) {
                    return true;
                } else {
                    return this.stateCount(STATE.FAILED) == 0;
                }
            },
        },
        methods: {
            async getInformation() {
                try {
                    this.state = STATE.LOADING;
                    let dom = await htmlLogic.getDOM(this.tmpUrl);

                    let img_urls = htmlLogic.getImagesByImgTag(this.tmpUrl, dom);
                    img_urls = img_urls.concat(htmlLogic.getImagesByFancyBox(this.tmpUrl, dom));

                    this.images = img_urls;
                    if (this.images.length > 0) {
                        this.state = STATE.UNACQUIRED;
                    } else {
                        this.state = STATE.READY;
                    }
                } catch (error) {
                    console.log(error);
                    window.alert(
                        "画像一覧の取得に失敗しました。"
                    );
                    this.state = STATE.READY;
                }
            },
            async startSave() {
                try {
                    this.state = STATE.LOADING;
                    if (this.images.length == 0) {
                        return;
                    }
                    if (this.projectCode == "") {
                        await this.getProjectCode();
                    }
                    await imageLogic.getImagesData(this.images, this.projectCode);

                    const retryFlag = (this.stateCount(STATE.FAILED) != 0);
                    if (this.autoRetry && retryFlag) {
                        await this.retryAll();
                    } else {
                        this.state = STATE.SAVED;
                    }
                } catch (error) {
                    this.state = STATE.UNACQUIRED;
                }
            },
            async toZip() {
                try {
                    this.state = STATE.LOADING;

                    const res = await $http("/image-scraping/api/ToZip.php?projectCode=" + this.projectCode);
                    const zipLink = await res.text();

                    window.open(zipLink, "_blank");
                    this.state = STATE.SAVED;
                } catch (error) {
                    console.log(error);
                    this.state = STATE.SAVED;
                }
            },
            toPPTX() {
                window.open(
                    "/image-scraping/api/Topptx.php?projectCode=" +
                    this.projectCode
                );
            },
            async getProjectCode() {
                const response = await $http("/image-scraping/api/ProjectMake.php");
                this.projectCode = await response.text();
            },
            refuse() {
                if (this.projectCode != "") {
                    $http(
                        `/image-scraping/api/Refuse.php?projectCode=${this.projectCode}`
                    );
                }
                this.state = STATE.READY;
                this.images = [];
                this.projectCode = "";
            },
            async retryAll() {
                this.state = STATE.LOADING;

                let images = this.images.filter((e) => e.state == STATE.FAILED);
                await imageLogic.getImagesData(images, this.projectCode);

                this.state = STATE.SAVED;
            },
            getStateStr(state) {
                switch (state) {
                    case STATE.READY:
                        return "準備完了";
                    case STATE.UNACQUIRED:
                        return "未取得";
                    case STATE.OBTAINING:
                        return "取得中";
                    case STATE.OBTAINED:
                        return "取得済";
                    case STATE.SAVED:
                        return "保存済";
                    case STATE.FAILED:
                        return "失敗";
                    case STATE.LOADING:
                        return "ロード中";
                }
            },
            stateCount(stateStr) {
                if (this.images.length == 0) return 0;
                return this.images.filter((e) => e.state == stateStr).length;
            },
        },
    }).mount("#app");
};
