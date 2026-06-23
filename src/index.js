
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
import "../style.css";
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import { createApp } from "vue";
import { STATE } from "./lib/constant.js";
import { $http } from "./lib/axios.js";
import htmlAnalyzer from "./lib/html.js";
import communication from "./lib/communication.js";
import { getImages, deleteImages, saveHistory, getHistory, deleteHistoryItem, pruneOldHistory, getRandomImage } from "./lib/indexeddb.js";

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function getImageDimensions(blob) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(url);
        };
        img.src = url;
    });
}

window.onload = () => {
    createApp({
        data() {
            return {
                tmpUrl: "",
                images: [],
                projectCode: "",
                state: STATE.READY,
                autoRetry: true,
                history: [],
                historyThumbnails: {},
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
            allSelected() {
                return this.images.length > 0 && this.images.every(img => img.selected);
            },
            hasSelection() {
                return this.images.some(img => img.selected);
            },
        },
        async created() {
            await pruneOldHistory();
            this.history = await getHistory();
            await this.loadHistoryThumbnails();
        },
        methods: {
            async getInformation() {
                try {
                    this.state = STATE.LOADING;
                    let dom = await htmlAnalyzer.getDOM(this.tmpUrl);

                    let img_urls = htmlAnalyzer.getImagesByImgTag(this.tmpUrl, dom);
                    img_urls = img_urls.concat(htmlAnalyzer.getImagesByFancyBox(this.tmpUrl, dom));

                    this.images = img_urls.map(img => ({ ...img, selected: false }));
                    if (this.images.length > 0) {
                        this.state = STATE.UNACQUIRED;
                    } else {
                        this.state = STATE.READY;
                    }
                } catch (error) {
                    console.log(error);
                    window.alert("画像一覧の取得に失敗しました。");
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
                        await saveHistory(this.projectCode, this.tmpUrl, this.images);
                        this.history = await getHistory();
                        await this.loadHistoryThumbnails();
                    }
                } catch (error) {
                    console.log(error);
                    this.state = STATE.UNACQUIRED;
                }
            },
            async toZip() {
                try {
                    this.state = STATE.LOADING;

                    const images = await getImages(this.projectCode);
                    const zip = new JSZip();
                    for (const imgData of images) {
                        zip.file(imgData.fileName, imgData.blob);
                    }
                    const content = await zip.generateAsync({ type: "blob" });
                    const url = URL.createObjectURL(content);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = this.projectCode + ".zip";
                    a.click();
                    URL.revokeObjectURL(url);

                    this.state = STATE.SAVED;
                } catch (error) {
                    console.log(error);
                    this.state = STATE.SAVED;
                }
            },
            async toPPTX() {
                try {
                    this.state = STATE.LOADING;

                    const images = await getImages(this.projectCode);
                    const pptx = new PptxGenJS();
                    pptx.defineLayout({ name: 'A4_LANDSCAPE', width: 11.693, height: 8.268 });
                    pptx.layout = 'A4_LANDSCAPE';

                    const SLIDE_W = 11.693;
                    const SLIDE_H = 8.268;

                    for (const imgData of images) {
                        const dataUrl = await blobToDataUrl(imgData.blob);
                        const { width: imgW, height: imgH } = await getImageDimensions(imgData.blob);
                        const aspectRatio = imgW / imgH;

                        let w, h, x, y;
                        if (aspectRatio > SLIDE_W / SLIDE_H) {
                            w = SLIDE_W;
                            h = SLIDE_W / aspectRatio;
                            x = 0;
                            y = (SLIDE_H - h) / 2;
                        } else {
                            h = SLIDE_H;
                            w = SLIDE_H * aspectRatio;
                            x = (SLIDE_W - w) / 2;
                            y = 0;
                        }

                        const slide = pptx.addSlide();
                        slide.addImage({ data: dataUrl, x, y, w, h });
                    }

                    await pptx.writeFile({ fileName: this.projectCode + '.pptx' });
                    this.state = STATE.SAVED;
                } catch (error) {
                    console.log(error);
                    this.state = STATE.SAVED;
                }
            },
            async getProjectCode() {
                const targetUrl = this.tmpUrl;
                const response = await $http("/image-scraping/api/ProjectMake.php?url=" + targetUrl);
                this.projectCode = await response.text();
            },
            async refuse() {
                // SAVED状態になっていない場合は未完了画像をクリーンアップ
                if (this.projectCode && this.state !== STATE.SAVED) {
                    await deleteImages(this.projectCode);
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
                await saveHistory(this.projectCode, this.tmpUrl, this.images);
                this.history = await getHistory();
                await this.loadHistoryThumbnails();
            },
            async getImage(image) {
                const index = this.images.indexOf(image);
                await communication.getImage(image, this.projectCode, index);
            },
            toggleSelectAll() {
                const select = !this.allSelected;
                this.images.forEach(img => { img.selected = select; });
            },
            async downloadSelectedZip() {
                try {
                    this.state = STATE.LOADING;
                    const selectedIndices = new Set(
                        this.images.map((img, i) => img.selected ? i : -1).filter(i => i >= 0)
                    );
                    const allImages = await getImages(this.projectCode);
                    const selected = allImages.filter(img => selectedIndices.has(img.orderNumber));

                    const zip = new JSZip();
                    for (const imgData of selected) {
                        zip.file(imgData.fileName, imgData.blob);
                    }
                    const content = await zip.generateAsync({ type: "blob" });
                    const url = URL.createObjectURL(content);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = this.projectCode + "_selected.zip";
                    a.click();
                    URL.revokeObjectURL(url);
                    this.state = STATE.SAVED;
                } catch (error) {
                    console.log(error);
                    this.state = STATE.SAVED;
                }
            },
            async downloadSelectedPPTX() {
                try {
                    this.state = STATE.LOADING;
                    const selectedIndices = new Set(
                        this.images.map((img, i) => img.selected ? i : -1).filter(i => i >= 0)
                    );
                    const allImages = await getImages(this.projectCode);
                    const selected = allImages.filter(img => selectedIndices.has(img.orderNumber));

                    const pptx = new PptxGenJS();
                    pptx.defineLayout({ name: 'A4_LANDSCAPE', width: 11.693, height: 8.268 });
                    pptx.layout = 'A4_LANDSCAPE';

                    const SLIDE_W = 11.693;
                    const SLIDE_H = 8.268;

                    for (const imgData of selected) {
                        const dataUrl = await blobToDataUrl(imgData.blob);
                        const { width: imgW, height: imgH } = await getImageDimensions(imgData.blob);
                        const aspectRatio = imgW / imgH;

                        let w, h, x, y;
                        if (aspectRatio > SLIDE_W / SLIDE_H) {
                            w = SLIDE_W;
                            h = SLIDE_W / aspectRatio;
                            x = 0;
                            y = (SLIDE_H - h) / 2;
                        } else {
                            h = SLIDE_H;
                            w = SLIDE_H * aspectRatio;
                            x = (SLIDE_W - w) / 2;
                            y = 0;
                        }

                        const slide = pptx.addSlide();
                        slide.addImage({ data: dataUrl, x, y, w, h });
                    }

                    await pptx.writeFile({ fileName: this.projectCode + '_selected.pptx' });
                    this.state = STATE.SAVED;
                } catch (error) {
                    console.log(error);
                    this.state = STATE.SAVED;
                }
            },
            async restoreProject(item) {
                this.state = STATE.LOADING;
                this.projectCode = item.projectCode;
                this.tmpUrl = item.url;

                const blobs = await getImages(item.projectCode);
                const blobMap = {};
                blobs.forEach(b => { blobMap[b.orderNumber] = b; });

                this.images = item.imageMeta.map((img, i) => ({
                    ...img,
                    selected: false,
                    thumbnail: blobMap[i] ? URL.createObjectURL(blobMap[i].blob) : null,
                }));

                this.state = STATE.SAVED;
            },
            async loadHistoryThumbnails() {
                Object.values(this.historyThumbnails).forEach(url => URL.revokeObjectURL(url));
                const thumbnails = {};
                await Promise.allSettled(
                    this.history.map(async (item) => {
                        const img = await getRandomImage(item.projectCode);
                        if (img) thumbnails[item.projectCode] = URL.createObjectURL(img.blob);
                    })
                );
                this.historyThumbnails = thumbnails;
            },
            async downloadHistoryPPTX(item) {
                const prevState = this.state;
                try {
                    this.state = STATE.LOADING;
                    const images = await getImages(item.projectCode);
                    const pptx = new PptxGenJS();
                    pptx.defineLayout({ name: 'A4_LANDSCAPE', width: 11.693, height: 8.268 });
                    pptx.layout = 'A4_LANDSCAPE';

                    const SLIDE_W = 11.693;
                    const SLIDE_H = 8.268;

                    for (const imgData of images) {
                        const dataUrl = await blobToDataUrl(imgData.blob);
                        const { width: imgW, height: imgH } = await getImageDimensions(imgData.blob);
                        const aspectRatio = imgW / imgH;

                        let w, h, x, y;
                        if (aspectRatio > SLIDE_W / SLIDE_H) {
                            w = SLIDE_W;
                            h = SLIDE_W / aspectRatio;
                            x = 0;
                            y = (SLIDE_H - h) / 2;
                        } else {
                            h = SLIDE_H;
                            w = SLIDE_H * aspectRatio;
                            x = (SLIDE_W - w) / 2;
                            y = 0;
                        }

                        const slide = pptx.addSlide();
                        slide.addImage({ data: dataUrl, x, y, w, h });
                    }

                    await pptx.writeFile({ fileName: item.projectCode + '.pptx' });
                } catch (error) {
                    console.log(error);
                } finally {
                    this.state = prevState;
                }
            },
            async removeHistory(item) {
                if (!confirm(`「${item.url}」の履歴と画像データを削除しますか？`)) return;
                await deleteHistoryItem(item.projectCode);
                this.history = await getHistory();
                await this.loadHistoryThumbnails();
                if (this.projectCode === item.projectCode) {
                    this.state = STATE.READY;
                    this.images = [];
                    this.projectCode = "";
                }
            },
            formatDate(isoString) {
                const d = new Date(isoString);
                return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            },
            getStateStr(state) {
                switch (state) {
                    case STATE.READY: return "準備完了";
                    case STATE.UNACQUIRED: return "未取得";
                    case STATE.OBTAINING: return "取得中";
                    case STATE.OBTAINED: return "取得済";
                    case STATE.SAVED: return "保存済";
                    case STATE.FAILED: return "失敗";
                    case STATE.LOADING: return "ロード中";
                }
            },
            stateCount(stateStr) {
                if (this.images.length == 0) return 0;
                return this.images.filter((e) => e.state == stateStr).length;
            },
        },
    }).mount("#app");
};
