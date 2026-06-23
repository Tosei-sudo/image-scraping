import { parseURL } from '../lib/axios.js';

describe('parseURL', () => {
    test('absolute HTTP URL is returned unchanged', () => {
        expect(parseURL('https://base.com/', 'https://other.com/img.png'))
            .toBe('https://other.com/img.png');
    });

    test('protocol-relative URL resolves to HTTPS using base scheme', () => {
        expect(parseURL('https://base.com/', '//cdn.example.com/img.png'))
            .toBe('https://cdn.example.com/img.png');
    });

    test('absolute path resolves against base origin', () => {
        expect(parseURL('https://base.com/path/', '/images/img.png'))
            .toBe('https://base.com/images/img.png');
    });

    test('relative path resolves against base directory', () => {
        expect(parseURL('https://base.com/shop/', '../images/img.png'))
            .toBe('https://base.com/images/img.png');
    });

    test('data: URL is returned as-is', () => {
        const dataUrl = 'data:image/png;base64,abc123==';
        expect(parseURL('https://base.com/', dataUrl)).toBe(dataUrl);
    });

    test('URL with query string is preserved', () => {
        expect(parseURL('https://base.com/', 'https://cdn.com/img.png?v=2'))
            .toBe('https://cdn.com/img.png?v=2');
    });
});
