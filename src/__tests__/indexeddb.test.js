import {
    saveImage, getImages, deleteImages,
    saveHistory, getHistory, deleteHistoryItem,
    getRandomImage, pruneOldHistory,
} from '../lib/indexeddb.js';

// fake-indexeddb is loaded globally via setup.js
// Use unique projectCode per test to avoid cross-test contamination

let counter = 0;
function uniqueProject() {
    return `test-project-${counter++}`;
}

function makeBlob(content = 'image data') {
    return new Blob([content], { type: 'image/png' });
}

function makeImages(count = 2) {
    return Array.from({ length: count }, (_, i) => ({
        src: `https://example.com/img${i}.png`,
        state: 4,
        referer: 'https://example.com',
        blocking: true,
    }));
}

// ─── saveImage / getImages ────────────────────────────────────────────────────

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

// ─── deleteImages ─────────────────────────────────────────────────────────────

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

// ─── saveHistory / getHistory ─────────────────────────────────────────────────

describe('saveHistory / getHistory', () => {
    test('saved entry is retrievable', async () => {
        const proj = uniqueProject();
        const images = makeImages(3);
        await saveHistory(proj, 'https://example.com', images);

        const history = await getHistory();
        const entry = history.find(h => h.projectCode === proj);
        expect(entry).toBeDefined();
        expect(entry.url).toBe('https://example.com');
        expect(entry.imageCount).toBe(3);
        expect(entry.imageMeta).toHaveLength(3);
    });

    test('imageMeta contains src, state, referer, blocking', async () => {
        const proj = uniqueProject();
        const images = [{ src: 'https://example.com/img.png', state: 4, referer: 'https://example.com', blocking: true }];
        await saveHistory(proj, 'https://example.com', images);

        const history = await getHistory();
        const entry = history.find(h => h.projectCode === proj);
        expect(entry.imageMeta[0]).toMatchObject({
            src: 'https://example.com/img.png',
            state: 4,
            referer: 'https://example.com',
            blocking: true,
        });
    });

    test('getHistory returns entries sorted by timestamp descending', async () => {
        const projA = uniqueProject();
        const projB = uniqueProject();

        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        await saveHistory(projA, 'https://a.example.com', []);

        jest.setSystemTime(new Date('2026-01-02T00:00:00Z'));
        await saveHistory(projB, 'https://b.example.com', []);
        jest.useRealTimers();

        const history = await getHistory();
        const codes = history.map(h => h.projectCode);
        expect(codes.indexOf(projB)).toBeLessThan(codes.indexOf(projA));
    });

    test('saving with same projectCode overwrites the entry', async () => {
        const proj = uniqueProject();
        await saveHistory(proj, 'https://first.example.com', makeImages(1));
        await saveHistory(proj, 'https://second.example.com', makeImages(5));

        const history = await getHistory();
        const entries = history.filter(h => h.projectCode === proj);
        expect(entries).toHaveLength(1);
        expect(entries[0].url).toBe('https://second.example.com');
        expect(entries[0].imageCount).toBe(5);
    });

    test('timestamp is stored as ISO string', async () => {
        const proj = uniqueProject();
        await saveHistory(proj, 'https://example.com', []);

        const history = await getHistory();
        const entry = history.find(h => h.projectCode === proj);
        expect(() => new Date(entry.timestamp)).not.toThrow();
        expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
    });
});

// ─── getRandomImage ───────────────────────────────────────────────────────────

describe('getRandomImage', () => {
    test('returns null when project has no images', async () => {
        const result = await getRandomImage('no-such-project');
        expect(result).toBeNull();
    });

    test('returns a valid image record from the project', async () => {
        const proj = uniqueProject();
        const blob = makeBlob();
        await saveImage(proj, 0, 'a.png', blob);
        await saveImage(proj, 1, 'b.png', blob);

        const result = await getRandomImage(proj);
        expect(result).not.toBeNull();
        expect(result.projectCode).toBe(proj);
        expect(['a.png', 'b.png']).toContain(result.fileName);
    });

    test('does not return images from a different project', async () => {
        const projA = uniqueProject();
        const projB = uniqueProject();
        const blob = makeBlob();
        await saveImage(projA, 0, 'a-only.png', blob);
        await saveImage(projB, 0, 'b-only.png', blob);

        const result = await getRandomImage(projA);
        expect(result.fileName).toBe('a-only.png');
    });
});

// ─── deleteHistoryItem ────────────────────────────────────────────────────────

describe('deleteHistoryItem', () => {
    test('removes the history entry', async () => {
        const proj = uniqueProject();
        await saveHistory(proj, 'https://example.com', makeImages(1));

        await deleteHistoryItem(proj);

        const history = await getHistory();
        expect(history.find(h => h.projectCode === proj)).toBeUndefined();
    });

    test('also removes associated images', async () => {
        const proj = uniqueProject();
        const blob = makeBlob();
        await saveHistory(proj, 'https://example.com', makeImages(1));
        await saveImage(proj, 0, 'img.png', blob);

        await deleteHistoryItem(proj);

        expect(await getImages(proj)).toHaveLength(0);
    });

    test('does not affect other projects', async () => {
        const projDel = uniqueProject();
        const projKeep = uniqueProject();
        const blob = makeBlob();
        await saveHistory(projDel, 'https://del.example.com', []);
        await saveHistory(projKeep, 'https://keep.example.com', []);
        await saveImage(projKeep, 0, 'keep.png', blob);

        await deleteHistoryItem(projDel);

        const history = await getHistory();
        expect(history.find(h => h.projectCode === projKeep)).toBeDefined();
        expect(await getImages(projKeep)).toHaveLength(1);
    });
});

// ─── pruneOldHistory ──────────────────────────────────────────────────────────

describe('pruneOldHistory', () => {
    test('removes entries older than 3 days', async () => {
        const oldProj = uniqueProject();

        jest.useFakeTimers();
        jest.setSystemTime(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000));
        await saveHistory(oldProj, 'https://old.example.com', []);
        jest.useRealTimers();

        await pruneOldHistory();

        const history = await getHistory();
        expect(history.find(h => h.projectCode === oldProj)).toBeUndefined();
    });

    test('keeps entries within 3 days', async () => {
        const recentProj = uniqueProject();

        jest.useFakeTimers();
        jest.setSystemTime(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));
        await saveHistory(recentProj, 'https://recent.example.com', []);
        jest.useRealTimers();

        await pruneOldHistory();

        const history = await getHistory();
        expect(history.find(h => h.projectCode === recentProj)).toBeDefined();
    });

    test('also deletes images belonging to pruned entries', async () => {
        const oldProj = uniqueProject();
        const blob = makeBlob();

        jest.useFakeTimers();
        jest.setSystemTime(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000));
        await saveHistory(oldProj, 'https://old.example.com', makeImages(1));
        jest.useRealTimers();

        await saveImage(oldProj, 0, 'img.png', blob);
        await pruneOldHistory();

        expect(await getImages(oldProj)).toHaveLength(0);
    });

    test('resolves without error when history is empty', async () => {
        await expect(pruneOldHistory()).resolves.not.toThrow();
    });
});
