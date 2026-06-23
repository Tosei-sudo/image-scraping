import { saveImage, getImages, deleteImages } from '../lib/indexeddb.js';

// fake-indexeddb is loaded globally via setup.js
// Use unique projectCode per test to avoid cross-test contamination

let counter = 0;
function uniqueProject() {
    return `test-project-${counter++}`;
}

function makeBlob(content = 'image data') {
    return new Blob([content], { type: 'image/png' });
}

describe('saveImage / getImages', () => {
    test('saved record is retrievable by projectCode', async () => {
        const proj = uniqueProject();
        const blob = makeBlob();
        await saveImage(proj, 0, 'a.png', blob);

        const images = await getImages(proj);
        expect(images).toHaveLength(1);
        expect(images[0].fileName).toBe('a.png');
        expect(images[0].projectCode).toBe(proj);
        expect(images[0].orderNumber).toBe(0);
    });

    test('getImages returns records sorted by orderNumber', async () => {
        const proj = uniqueProject();
        const blob = makeBlob();
        await saveImage(proj, 2, 'c.png', blob);
        await saveImage(proj, 0, 'a.png', blob);
        await saveImage(proj, 1, 'b.png', blob);

        const images = await getImages(proj);
        expect(images.map(i => i.orderNumber)).toEqual([0, 1, 2]);
    });

    test('getImages returns empty array for unknown projectCode', async () => {
        const images = await getImages('non-existent-project');
        expect(images).toHaveLength(0);
    });

    test('multiple images under one project are all returned', async () => {
        const proj = uniqueProject();
        const blob = makeBlob();
        await Promise.all([
            saveImage(proj, 0, 'a.png', blob),
            saveImage(proj, 1, 'b.png', blob),
            saveImage(proj, 2, 'c.png', blob),
        ]);

        const images = await getImages(proj);
        expect(images).toHaveLength(3);
    });

    test('images from different projects are isolated', async () => {
        const projA = uniqueProject();
        const projB = uniqueProject();
        const blob = makeBlob();
        await saveImage(projA, 0, 'a.png', blob);
        await saveImage(projB, 0, 'b.png', blob);

        expect(await getImages(projA)).toHaveLength(1);
        expect(await getImages(projB)).toHaveLength(1);
        expect((await getImages(projA))[0].fileName).toBe('a.png');
    });
});

describe('deleteImages', () => {
    test('removes all images for the given projectCode', async () => {
        const proj = uniqueProject();
        const blob = makeBlob();
        await saveImage(proj, 0, 'x.png', blob);
        await saveImage(proj, 1, 'y.png', blob);

        await deleteImages(proj);
        expect(await getImages(proj)).toHaveLength(0);
    });

    test('does not remove images from other projects', async () => {
        const projDel = uniqueProject();
        const projKeep = uniqueProject();
        const blob = makeBlob();
        await saveImage(projDel, 0, 'del.png', blob);
        await saveImage(projKeep, 0, 'keep.png', blob);

        await deleteImages(projDel);

        expect(await getImages(projDel)).toHaveLength(0);
        expect(await getImages(projKeep)).toHaveLength(1);
    });

    test('resolves without error when projectCode has no images', async () => {
        await expect(deleteImages('empty-project')).resolves.toBeUndefined();
    });
});
