
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
import { STATE } from "./lib/constant.js";
import { $http } from "./lib/axios.js";
import htmlAnalyzer from "./lib/html.js";
import communication from "./lib/communication.js";

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
                    let dom = await htmlAnalyzer.getDOM(this.tmpUrl);
                    
                    let img_urls = htmlAnalyzer.getImagesByImgTag(this.tmpUrl, dom);
                    img_urls = img_urls.concat(htmlAnalyzer.getImagesByFancyBox(this.tmpUrl, dom));

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
                    await communication.getImagesData(this.images, this.projectCode);

                    const retryFlag = (this.stateCount(STATE.FAILED) != 0);
                    if (this.autoRetry && retryFlag) {
                        await this.retryAll();
                    } else {
                        this.state = STATE.SAVED;
                    }
                } catch (error) {
                    console.log(error)
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
                const targetUrl = this.tmpUrl;
                const response = await $http("/image-scraping/api/ProjectMake.php?url=" + targetUrl);
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
                await communication.getImagesData(images, this.projectCode);

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
