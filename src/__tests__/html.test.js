jest.mock('../lib/axios.js', () => ({
    $http: jest.fn(),
    parseURL: jest.requireActual('../lib/axios.js').parseURL,
}));

import htmlAnalyzer from '../lib/html.js';

const BASE_URL = 'https://example.com/shop/';

function parseHTML(html) {
    return new DOMParser().parseFromString(html, 'text/html');
}

describe('getImagesByImgTag', () => {
    test('extracts absolute image URLs from img tags', () => {
        const dom = parseHTML(`
            <html><body>
                <img src="https://cdn.example.com/a.png" />
                <img src="https://cdn.example.com/b.jpg" />
            </body></html>
        `);
        const images = htmlAnalyzer.getImagesByImgTag(BASE_URL, dom);
        expect(images).toHaveLength(2);
        expect(images[0].src).toBe('https://cdn.example.com/a.png');
        expect(images[1].src).toBe('https://cdn.example.com/b.jpg');
    });

    test('resolves relative paths against base URL', () => {
        const dom = parseHTML(`<html><body><img src="/images/logo.png" /></body></html>`);
        const images = htmlAnalyzer.getImagesByImgTag(BASE_URL, dom);
        expect(images[0].src).toBe('https://example.com/images/logo.png');
    });

    test('sets state to UNACQUIRED (1) for each image', () => {
        const dom = parseHTML(`<html><body><img src="https://example.com/a.png" /></body></html>`);
        const images = htmlAnalyzer.getImagesByImgTag(BASE_URL, dom);
        expect(images[0].state).toBe(1); // STATE.UNACQUIRED
    });

    test('sets referer to base URL for each image', () => {
        const dom = parseHTML(`<html><body><img src="https://example.com/a.png" /></body></html>`);
        const images = htmlAnalyzer.getImagesByImgTag(BASE_URL, dom);
        expect(images[0].referer).toBe(BASE_URL);
    });

    test('returns empty array when no img tags', () => {
        const dom = parseHTML(`<html><body><p>no images here</p></body></html>`);
        const images = htmlAnalyzer.getImagesByImgTag(BASE_URL, dom);
        expect(images).toHaveLength(0);
    });
});

describe('getImagesByFancyBox', () => {
    test('extracts images from $.fancybox.open call', () => {
        const dom = parseHTML(`
            <html><body>
                <script>
                    $.fancybox.open([{href: "/gallery/a.jpg"}, {href: "/gallery/b.jpg"}])
                </script>
            </body></html>
        `);
        const images = htmlAnalyzer.getImagesByFancyBox(BASE_URL, dom);
        expect(images).toHaveLength(2);
        expect(images[0].src).toBe('https://example.com/gallery/a.jpg');
        expect(images[1].src).toBe('https://example.com/gallery/b.jpg');
    });

    test('extracts images from $.revo_fancybox.open call', () => {
        const dom = parseHTML(`
            <html><body>
                <script>
                    $.revo_fancybox.open([{href: "/gallery/c.jpg"}])
                </script>
            </body></html>
        `);
        const images = htmlAnalyzer.getImagesByFancyBox(BASE_URL, dom);
        expect(images).toHaveLength(1);
        expect(images[0].src).toBe('https://example.com/gallery/c.jpg');
    });

    test('returns empty array when no fancybox.open call', () => {
        const dom = parseHTML(`
            <html><body>
                <script>console.log("hello");</script>
            </body></html>
        `);
        const images = htmlAnalyzer.getImagesByFancyBox(BASE_URL, dom);
        expect(images).toHaveLength(0);
    });

    test('does not crash on malformed script content', () => {
        const dom = parseHTML(`
            <html><body>
                <script>$.fancybox.open(</script>
            </body></html>
        `);
        // Should not throw; returns empty or partial results
        expect(() => htmlAnalyzer.getImagesByFancyBox(BASE_URL, dom)).not.toThrow();
    });

    test('returns empty array when no script tags', () => {
        const dom = parseHTML(`<html><body><p>text only</p></body></html>`);
        const images = htmlAnalyzer.getImagesByFancyBox(BASE_URL, dom);
        expect(images).toHaveLength(0);
    });
});
