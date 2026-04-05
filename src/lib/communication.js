import { STATE } from "./constant.js";
import { $http } from "./axios.js";

const Logic = {
    getImagesData: async function (images, projectCode) {
        let tasks = [], group = [];
        // 各画像の取得処理を非同期で実行。ただし、負荷分散のため3つずつまとめて実行
        for (let index = 0; index < images.length; index++) {
            const image = images[index];
            if (!image.blocking) {
                tasks.push(this.getImage(image, projectCode, index));
            } else {
                group.push(this.getImage(image, projectCode, index));
            }
            if (group.length == 3 || index == images.length - 1) {
                await Promise.allSettled(group);
                group = [];
            }
        }

        await Promise.allSettled(tasks);
    },
    getImage: async function (image, projectCode, orderNumber=-1) {
        try {
            image.state = STATE.OBTAINING;

            let file;
            if (image.src.slice(0, 5) == "data:") {
                file = this.getImageByDataURL(image.src)
            } else {
                file = await this.getImageByURL(image);
            }

            image.state = STATE.OBTAINED;

            await this.saveImage(file, projectCode, orderNumber);

            image.state = STATE.SAVED;
        } catch (error) {
            console.log(error)
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
    saveImage: async function (file, projectCode, orderNumber=-1) {
        let formData = new FormData();

        formData.append("image", file);
        formData.append("projectCode", projectCode);

        const name = orderNumber == -1 ? file.name : orderNumber + "_" + file.name;
        formData.append("fileName", name);

        await $http("/image-scraping/api/SaveImage.php", "POST", formData);
    },
};

export default Logic;