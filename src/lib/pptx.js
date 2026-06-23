import PptxGenJS from "pptxgenjs";

const SLIDE_W = 11.693;
const SLIDE_H = 8.268;

export function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

export function getImageDimensions(blob) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(url);
        };
        img.onerror = () => {
            resolve({ width: 0, height: 0 });
            URL.revokeObjectURL(url);
        };
        img.src = url;
    });
}

export function calcImagePosition(imgW, imgH) {
    const aspectRatio = imgW / imgH;
    let w, h, x, y;
    if (!imgW || !imgH || !isFinite(aspectRatio)) {
        w = SLIDE_W;
        h = SLIDE_H;
        x = 0;
        y = 0;
    } else if (aspectRatio > SLIDE_W / SLIDE_H) {
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
    return { w, h, x, y };
}

export async function rasterizeSvgToPng(svgBlob, defaultW = 800, defaultH = 600) {
    const url = URL.createObjectURL(svgBlob);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const w = img.naturalWidth || defaultW;
            const h = img.naturalHeight || defaultH;
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            canvas.toBlob(blob => {
                URL.revokeObjectURL(url);
                resolve(blob || svgBlob);
            }, 'image/png');
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(svgBlob);
        };
        img.src = url;
    });
}

function isSvg(imgData) {
    if (imgData.blob && (imgData.blob.type === 'image/svg+xml' || imgData.blob.type === 'image/svg')) return true;
    if (imgData.fileName && imgData.fileName.toLowerCase().endsWith('.svg')) return true;
    return false;
}

export async function buildPptx(images) {
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: 'A4_LANDSCAPE', width: SLIDE_W, height: SLIDE_H });
    pptx.layout = 'A4_LANDSCAPE';

    for (const imgData of images) {
        let blob = imgData.blob;
        if (isSvg(imgData)) {
            blob = await rasterizeSvgToPng(blob);
        }
        const dataUrl = await blobToDataUrl(blob);
        const { width: imgW, height: imgH } = await getImageDimensions(blob);
        const { w, h, x, y } = calcImagePosition(imgW, imgH);

        const slide = pptx.addSlide();
        slide.addImage({ data: dataUrl, x, y, w, h });
    }

    return pptx;
}
