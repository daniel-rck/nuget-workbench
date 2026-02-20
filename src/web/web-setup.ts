import { JSDOM } from 'jsdom';
import * as path from 'path';
import * as tsConfigPaths from 'tsconfig-paths';
import * as Module from 'module';

// Hook require to ignore pure CSS files but allow .css.ts/.css.js modules through.
// Components import styles like `@/web/styles/codicon.css` which resolve to `.css.js`
// files after compilation. We must let those through so Lit gets CSSResult objects.
const originalRequire = (Module as any).prototype.require;
(Module as any).prototype.require = function(id: string) {
    if (typeof id === 'string' && id.endsWith('.css')) {
        // Try loading the module normally first (handles .css.js compiled from .css.ts)
        try {
            return originalRequire.call(this, id);
        } catch {
            // Pure .css file with no .js counterpart — return empty string
            return '';
        }
    }
    return originalRequire.call(this, id);
};

// Register paths to point to 'out' directory
const baseUrl = path.resolve(__dirname, '../..'); // Repo root
tsConfigPaths.register({
    baseUrl,
    paths: {
        "@/*": ["out/*"]
    }
});

// Setup JSDOM
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true
});

(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).HTMLElement = dom.window.HTMLElement;
(global as any).customElements = dom.window.customElements;
(global as any).Node = dom.window.Node;
(global as any).Event = dom.window.Event;
(global as any).InputEvent = dom.window.InputEvent;
(global as any).KeyboardEvent = dom.window.KeyboardEvent;
(global as any).MouseEvent = dom.window.MouseEvent;
(global as any).CustomEvent = dom.window.CustomEvent;
(global as any).MutationObserver = dom.window.MutationObserver;
(global as any).HTMLStyleElement = dom.window.HTMLStyleElement; // Required for Lit element styles

// Polyfill window.matchMedia
(global as any).window.matchMedia = (global as any).window.matchMedia || function() {
    return {
        matches: false,
        addListener: function() {},
        removeListener: function() {}
    };
};

// Polyfill acquireVsCodeApi
(global as any).window.acquireVsCodeApi = () => ({
    postMessage: () => {},
    setState: () => {},
    getState: () => {}
});
(global as any).acquireVsCodeApi = (global as any).window.acquireVsCodeApi;

// Polyfill navigator (for Axios)
Object.defineProperty(global, 'navigator', {
    value: dom.window.navigator,
    writable: true
});

// RequestAnimationFrame polyfill (LitElement uses it)
(global as any).requestAnimationFrame = (callback: any) => setTimeout(callback, 0);
(global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
