import { STATE } from '../lib/constant.js';

describe('STATE constants', () => {
    test.each([
        ['READY', 0],
        ['UNACQUIRED', 1],
        ['OBTAINING', 2],
        ['OBTAINED', 3],
        ['SAVED', 4],
        ['FAILED', 5],
        ['LOADING', 99],
    ])('STATE.%s === %i', (key, value) => {
        expect(STATE[key]).toBe(value);
    });

    test('all values are unique', () => {
        const values = Object.values(STATE);
        expect(new Set(values).size).toBe(values.length);
    });
});
