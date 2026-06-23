import { blobToDataUrl, getImageDimensions, calcImagePosition, buildPptx, rasterizeSvgToPng } from '../lib/pptx.js';

// Mock pptxgenjs so tests don't actually generate PPTX files
jest.mock('pptxgenjs', () => {
    return jest.fn().mockImplementation(() => ({
        defineLayout: jest.fn(),
        layout: '',
        addSlide: jest.fn(() => ({ addImage: jest.fn() })),
        writeFile: jest.fn().mockResolvedValue(undefined),
        _slides: [],
    }));
});

// Track addSlide/addImage calls for assertion
let mockPptxInstance;
const PptxGenJS = require('pptxgenjs');
beforeEach(() => {
    PptxGenJS.mockClear();
    mockPptxInstance = null;
    PptxGenJS.mockImplementation(() => {
        const slides = [];
        mockPptxInstance = {
            defineLayout: jest.fn(),
            layout: '',
            addSlide: jest.fn(() => {
                const slide = { addImage: jest.fn() };
                slides.push(slide);
                return slide;
            }),
            writeFile: jest.fn().mockResolvedValue(undefined),
            _slides: slides,
        };
        return mockPptxInstance;
    });
});

// ─── blobToDataUrl ────────────────────────────────────────────────────────────

describe('blobToDataUrl', () => {
    test('resolves with a data URL string', async () => {
        const blob = new Blob(['fake image'], { type: 'image/png' });
        const result = await blobToDataUrl(blob);
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^data:image\/png;base64,/);
    });
});

// ─── getImageDimensions ───────────────────────────────────────────────────────

describe('getImageDimensions', () => {
    test('resolves with {width:0, height:0} when image fails to load (onerror path)', async () => {
        // jsdom Image.onload/onerror never fire, but URL.createObjectURL returns 'blob:mock-url'
        // We can test the onerror path by manually triggering it via mocking Image
        const OriginalImage = global.Image;
        global.Image = jest.fn().mockImplementation(() => {
            const img = { src: '', onload: null, onerror: null, naturalWidth: 0, naturalHeight: 0 };
            // Immediately trigger onerror when src is set
            Object.defineProperty(img, 'src', {
                set() { setTimeout(() => img.onerror && img.onerror(), 0); },
                get() { return ''; },
            });
            return img;
        });

        const blob = new Blob(['bad data'], { type: 'image/png' });
        const result = await getImageDimensions(blob);
        expect(result).toEqual({ width: 0, height: 0 });

        global.Image = OriginalImage;
    });

    test('resolves with dimensions when image loads successfully', async () => {
        const OriginalImage = global.Image;
        global.Image = jest.fn().mockImplementation(() => {
            const img = { src: '', onload: null, onerror: null, naturalWidth: 800, naturalHeight: 600 };
            Object.defineProperty(img, 'src', {
                set() { setTimeout(() => img.onload && img.onload(), 0); },
                get() { return ''; },
            });
            return img;
        });

        const blob = new Blob(['img data'], { type: 'image/png' });
        const result = await getImageDimensions(blob);
        expect(result).toEqual({ width: 800, height: 600 });

        global.Image = OriginalImage;
    });
});

// ─── calcImagePosition ────────────────────────────────────────────────────────

describe('calcImagePosition', () => {
    const SLIDE_W = 11.693;
    const SLIDE_H = 8.268;

    test('wide image: fills slide width, centers vertically', () => {
        const { w, h, x, y } = calcImagePosition(1600, 400);
        expect(w).toBeCloseTo(SLIDE_W);
        expect(x).toBeCloseTo(0);
        expect(h).toBeLessThan(SLIDE_H);
        expect(y).toBeGreaterThan(0);
    });

    test('tall image: fills slide height, centers horizontally', () => {
        const { w, h, x, y } = calcImagePosition(400, 1200);
        expect(h).toBeCloseTo(SLIDE_H);
        expect(y).toBeCloseTo(0);
        expect(w).toBeLessThan(SLIDE_W);
        expect(x).toBeGreaterThan(0);
    });

    test('square image: fills slide height, centers horizontally', () => {
        const { w, h, x, y } = calcImagePosition(100, 100);
        expect(h).toBeCloseTo(SLIDE_H);
        expect(y).toBeCloseTo(0);
        expect(x).toBeGreaterThan(0);
    });

    test('zero dimensions fall back to full slide', () => {
        const { w, h, x, y } = calcImagePosition(0, 0);
        expect(w).toBeCloseTo(SLIDE_W);
        expect(h).toBeCloseTo(SLIDE_H);
        expect(x).toBeCloseTo(0);
        expect(y).toBeCloseTo(0);
    });
});

// ─── buildPptx ───────────────────────────────────────────────────────────────

describe('buildPptx', () => {
    let OriginalImage;

    // Mock Image globally for buildPptx tests: each constructed Image triggers onload with given dims
    function setupImageMock(dimensionsList) {
        let callIndex = 0;
        global.Image = jest.fn().mockImplementation(() => {
            const dims = dimensionsList[callIndex++] || { width: 100, height: 100 };
            const img = {
                src: '',
                onload: null,
                onerror: null,
                naturalWidth: dims.width,
                naturalHeight: dims.height,
            };
            Object.defineProperty(img, 'src', {
                set() { setTimeout(() => img.onload && img.onload(), 0); },
                get() { return ''; },
            });
            return img;
        });
    }

    beforeEach(() => { OriginalImage = global.Image; });
    afterEach(() => { global.Image = OriginalImage; });

    function makeImageData() {
        return { blob: new Blob(['img'], { type: 'image/png' }) };
    }

    test('returns a pptx object', async () => {
        setupImageMock([{ width: 800, height: 600 }]);
        const pptx = await buildPptx([makeImageData()]);
        expect(pptx).toBeDefined();
        expect(mockPptxInstance.addSlide).toHaveBeenCalledTimes(1);
    });

    test('creates one slide per image', async () => {
        setupImageMock([{ width: 800, height: 600 }, { width: 400, height: 300 }]);
        await buildPptx([makeImageData(), makeImageData()]);
        expect(mockPptxInstance.addSlide).toHaveBeenCalledTimes(2);
    });

    test('works with empty image list', async () => {
        const pptx = await buildPptx([]);
        expect(pptx).toBeDefined();
        expect(mockPptxInstance.addSlide).not.toHaveBeenCalled();
    });

    test('uses A4_LANDSCAPE layout', async () => {
        await buildPptx([]);
        expect(mockPptxInstance.defineLayout).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'A4_LANDSCAPE', width: 11.693, height: 8.268 })
        );
    });

    test('still creates slide when image dimensions are zero (onerror path)', async () => {
        // onerror resolves with {width:0, height:0}; buildPptx should not hang or throw
        global.Image = jest.fn().mockImplementation(() => {
            const img = { src: '', onload: null, onerror: null, naturalWidth: 0, naturalHeight: 0 };
            Object.defineProperty(img, 'src', {
                set() { setTimeout(() => img.onerror && img.onerror(), 0); },
                get() { return ''; },
            });
            return img;
        });
        await buildPptx([makeImageData()]);
        expect(mockPptxInstance.addSlide).toHaveBeenCalledTimes(1);
    });
});

// ─── rasterizeSvgToPng ───────────────────────────────────────────────────────

describe('rasterizeSvgToPng', () => {
    let OriginalImage;

    beforeEach(() => { OriginalImage = global.Image; });
    afterEach(() => {
        global.Image = OriginalImage;
        jest.restoreAllMocks();
    });

    function mockCanvas(pngBlob) {
        return {
            width: 0, height: 0,
            getContext: jest.fn().mockReturnValue({ drawImage: jest.fn() }),
            toBlob: jest.fn((cb) => cb(pngBlob)),
        };
    }

    test('returns PNG blob when SVG loads and canvas.toBlob succeeds', async () => {
        const pngBlob = new Blob(['png'], { type: 'image/png' });
        const canvas = mockCanvas(pngBlob);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'canvas') return canvas;
            return HTMLElement.prototype;
        });

        global.Image = jest.fn().mockImplementation(() => {
            const img = { src: '', onload: null, onerror: null, naturalWidth: 100, naturalHeight: 80 };
            Object.defineProperty(img, 'src', {
                set() { setTimeout(() => img.onload && img.onload(), 0); },
                get() { return ''; },
            });
            return img;
        });

        const svgBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
        const result = await rasterizeSvgToPng(svgBlob);
        expect(result).toBe(pngBlob);
    });

    test('falls back to original SVG blob when canvas.toBlob returns null', async () => {
        const canvas = mockCanvas(null);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'canvas') return canvas;
            return HTMLElement.prototype;
        });

        global.Image = jest.fn().mockImplementation(() => {
            const img = { src: '', onload: null, onerror: null, naturalWidth: 0, naturalHeight: 0 };
            Object.defineProperty(img, 'src', {
                set() { setTimeout(() => img.onload && img.onload(), 0); },
                get() { return ''; },
            });
            return img;
        });

        const svgBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
        const result = await rasterizeSvgToPng(svgBlob);
        expect(result).toBe(svgBlob);
    });

    test('falls back to original SVG blob when image fails to load', async () => {
        global.Image = jest.fn().mockImplementation(() => {
            const img = { src: '', onload: null, onerror: null };
            Object.defineProperty(img, 'src', {
                set() { setTimeout(() => img.onerror && img.onerror(), 0); },
                get() { return ''; },
            });
            return img;
        });

        const svgBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
        const result = await rasterizeSvgToPng(svgBlob);
        expect(result).toBe(svgBlob);
    });
});

// ─── buildPptx SVG handling ───────────────────────────────────────────────────

describe('buildPptx SVG handling', () => {
    let OriginalImage;

    beforeEach(() => { OriginalImage = global.Image; });
    afterEach(() => {
        global.Image = OriginalImage;
        jest.restoreAllMocks();
    });

    function setupImageMock(dims = { width: 100, height: 100 }) {
        global.Image = jest.fn().mockImplementation(() => {
            const img = { src: '', onload: null, onerror: null, naturalWidth: dims.width, naturalHeight: dims.height };
            Object.defineProperty(img, 'src', {
                set() { setTimeout(() => img.onload && img.onload(), 0); },
                get() { return ''; },
            });
            return img;
        });
    }

    test('SVG blob (by MIME type) triggers canvas rasterization', async () => {
        setupImageMock({ width: 200, height: 200 });
        const pngBlob = new Blob(['png'], { type: 'image/png' });
        const canvas = {
            width: 0, height: 0,
            getContext: jest.fn().mockReturnValue({ drawImage: jest.fn() }),
            toBlob: jest.fn((cb) => cb(pngBlob)),
        };
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'canvas') return canvas;
            return HTMLElement.prototype;
        });

        const svgImageData = { blob: new Blob(['<svg></svg>'], { type: 'image/svg+xml' }) };
        await buildPptx([svgImageData]);

        expect(mockPptxInstance.addSlide).toHaveBeenCalledTimes(1);
        expect(canvas.toBlob).toHaveBeenCalled();
    });

    test('SVG detected by fileName extension triggers canvas rasterization', async () => {
        setupImageMock({ width: 200, height: 200 });
        const pngBlob = new Blob(['png'], { type: 'image/png' });
        const canvas = {
            width: 0, height: 0,
            getContext: jest.fn().mockReturnValue({ drawImage: jest.fn() }),
            toBlob: jest.fn((cb) => cb(pngBlob)),
        };
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'canvas') return canvas;
            return HTMLElement.prototype;
        });

        const svgImageData = {
            blob: new Blob(['<svg></svg>'], { type: 'application/octet-stream' }),
            fileName: '0_icon.svg',
        };
        await buildPptx([svgImageData]);

        expect(mockPptxInstance.addSlide).toHaveBeenCalledTimes(1);
        expect(canvas.toBlob).toHaveBeenCalled();
    });

    test('non-SVG image skips canvas rasterization', async () => {
        setupImageMock({ width: 800, height: 600 });
        const canvas = {
            width: 0, height: 0,
            getContext: jest.fn().mockReturnValue({ drawImage: jest.fn() }),
            toBlob: jest.fn(),
        };
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'canvas') return canvas;
            return HTMLElement.prototype;
        });

        const pngImageData = { blob: new Blob(['png'], { type: 'image/png' }), fileName: '0_photo.png' };
        await buildPptx([pngImageData]);

        expect(mockPptxInstance.addSlide).toHaveBeenCalledTimes(1);
        expect(canvas.toBlob).not.toHaveBeenCalled();
    });
});
