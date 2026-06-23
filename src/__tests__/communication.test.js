jest.mock('../lib/indexeddb.js', () => ({
    saveImage: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../lib/axios.js', () => ({
    $http: jest.fn(),
    parseURL: jest.fn((base, raw) => raw),
}));

import Logic from '../lib/communication.js';
import { saveImage as mockSaveImage } from '../lib/indexeddb.js';

beforeEach(() => jest.clearAllMocks());

describe('getImageByDataURL', () => {
    // Minimal 1×1 transparent PNG in base64
    const PNG_1X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    test('returns a File instance', () => {
        const file = Logic.getImageByDataURL(PNG_1X1);
        expect(file).toBeInstanceOf(File);
    });

    test('file extension matches MIME type (png)', () => {
        const file = Logic.getImageByDataURL(PNG_1X1);
        expect(file.name).toMatch(/\.png$/);
    });

    test('JPEG data URL produces .jpeg extension', () => {
        const jpegUrl = 'data:image/jpeg;base64,/9j/4AAQSkZ';
        const file = Logic.getImageByDataURL(jpegUrl);
        expect(file.name).toMatch(/\.jpeg$/);
    });
});

describe('saveImage', () => {
    test('prefixes filename with orderNumber when >= 0', async () => {
        const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
        await Logic.saveImage(file, 'project-abc', 5);
        expect(mockSaveImage).toHaveBeenCalledWith('project-abc', 5, '5_photo.jpg', file);
    });

    test('uses original filename when orderNumber is -1', async () => {
        const file = new File([''], 'photo.jpg', { type: 'image/jpeg' });
        await Logic.saveImage(file, 'project-abc', -1);
        expect(mockSaveImage).toHaveBeenCalledWith('project-abc', -1, 'photo.jpg', file);
    });

    test('orderNumber 0 is valid and prefixed', async () => {
        const file = new File([''], 'img.png', { type: 'image/png' });
        await Logic.saveImage(file, 'proj', 0);
        expect(mockSaveImage).toHaveBeenCalledWith('proj', 0, '0_img.png', file);
    });
});

describe('getImage', () => {
    test('sets state to FAILED when fetch throws', async () => {
        jest.spyOn(Logic, 'getImageByURL').mockRejectedValue(new Error('Network error'));

        const image = { src: 'https://example.com/img.png', referer: 'https://example.com', state: 1 };
        await Logic.getImage(image, 'proj', 0);

        expect(image.state).toBe(5); // STATE.FAILED
        jest.restoreAllMocks();
    });

    test('sets state to SAVED and creates thumbnail on success', async () => {
        const fakeFile = new File(['img'], 'img.png', { type: 'image/png' });
        jest.spyOn(Logic, 'getImageByURL').mockResolvedValue(fakeFile);

        const image = { src: 'https://example.com/img.png', referer: 'https://example.com', state: 1 };
        await Logic.getImage(image, 'proj', 0);

        expect(image.state).toBe(4); // STATE.SAVED
        expect(image.thumbnail).toBe('blob:mock-url');
        jest.restoreAllMocks();
    });
});

describe('getImagesData', () => {
    test('processes all images and each ends in SAVED or FAILED', async () => {
        const fakeFile = new File(['img'], 'img.png', { type: 'image/png' });
        jest.spyOn(Logic, 'getImageByURL').mockResolvedValue(fakeFile);

        const images = [
            { src: 'https://example.com/a.png', referer: 'https://example.com', state: 1, blocking: true },
            { src: 'https://example.com/b.png', referer: 'https://example.com', state: 1, blocking: true },
        ];
        await Logic.getImagesData(images, 'proj');

        expect(images.every(img => img.state === 4 || img.state === 5)).toBe(true);
        jest.restoreAllMocks();
    });

    test('non-blocking images are processed in parallel', async () => {
        const fakeFile = new File(['img'], 'img.png', { type: 'image/png' });
        jest.spyOn(Logic, 'getImageByURL').mockResolvedValue(fakeFile);

        const images = [
            { src: 'https://example.com/a.png', referer: 'https://example.com', state: 1, blocking: false },
            { src: 'https://example.com/b.png', referer: 'https://example.com', state: 1, blocking: false },
        ];
        await Logic.getImagesData(images, 'proj');

        expect(images.every(img => img.state === 4 || img.state === 5)).toBe(true);
        jest.restoreAllMocks();
    });
});
