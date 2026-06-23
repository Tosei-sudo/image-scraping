require('fake-indexeddb/auto');

// jsdom does not implement innerText for <script> elements; polyfill to match browser behaviour
if (typeof HTMLScriptElement !== 'undefined') {
    Object.defineProperty(HTMLScriptElement.prototype, 'innerText', {
        get() { return this.textContent; },
        configurable: true,
    });
}

// jsdom does not expose structuredClone (needed by fake-indexeddb)
if (typeof structuredClone === 'undefined') {
    global.structuredClone = function clone(val) {
        if (val === null || val === undefined) return val;
        if (typeof val !== 'object') return val;
        if (val instanceof Blob) return val.slice(0, val.size, val.type);
        if (Array.isArray(val)) return val.map(clone);
        return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, clone(v)]));
    };
}

// jsdom does not implement Blob.text() — polyfill via FileReader
if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
    Blob.prototype.text = function () {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(this);
        });
    };
}

// Minimal jQuery-like global used by html.js (webpack ProvidePlugin injects real jQuery at build time)
function $mock(selector, context) {
    const els = context ? Array.from(context.querySelectorAll(selector)) : [];
    return Object.assign(els, {
        each(fn) { els.forEach((el, i) => fn(i, el)); },
    });
}
global.$ = $mock;
global.jQuery = $mock;
