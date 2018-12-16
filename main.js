(async () => {
    'use strict';
    const nop = _ => _;
    const rand = n => ~~(Math.random() * n);
    const $ = selector => document.querySelector(selector);
    const $$ = selector => [...document.querySelectorAll(selector)];
    const count = (n, m = 0) => Array(n).fill(m).map((a, b) => a + b);
    const bounce = n => count(n * 2).map(x => (x < n ? x : n * 2 - x));
    const circle = function* (generator) { while (true) yield* generator };
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    const storageProxy = storage =>
        new Proxy(storage, {
            get(target, prop) {
                const raw = target.getItem(prop);
                return raw ? JSON.parse(raw) : null;
            },
            set(target, prop, value) {
                target.setItem(prop, JSON.stringify(value));
                return target.getItem(prop);
            }
        });

    const l = storageProxy(localStorage);
    dayjs.extend(dayjs_plugin_relativeTime);
    dayjs.locale(dayjs_locale_zh_cn);

    $('#theme-switch').onclick = function () {
        l.darkMode = document.body.classList.toggle('dark-mode');
        this.title = l.darkMode ? '白天模式' : '夜间模式';
        this.dataset.glyph = l.darkMode ? 'sun' : 'moon';
    };
    if (l.darkMode) $('#theme-switch').onclick();

    if (l.githubToken) $('#github-token').value = l.githubToken;
    const refreshRateLimit = async () => {
        const headers = {};
        if (l.githubToken) headers.Authorization = `token ${l.githubToken}`;
        const res = await fetch('https://api.github.com/rate_limit', { headers });
        const { resources: { core: { limit, remaining, reset } } } = await res.json();
        const text = `${remaining} / ${limit}`;
        const title = `${dayjs(reset * 1000).fromNow()}重置`;
        $('#rate-limit').textContent = text;
        $('#rate-limit').title = title;
        $('#rate-limit').dataset.reset = reset;
    };
    refreshRateLimit();
    const refreshGithubToken = () => {
        const i = $('#github-token');
        if (i.validity.valid && i.value !== l.githubToken) {
            l.githubToken = i.value;
            refreshRateLimit();
        }
    };
    $('#github-token').onchange = refreshGithubToken;

    $('#clear-storage').onclick = () => {
        localStorage.clear();
        window.location.reload(false);
    };

    $('#show-info').onclick = () => $('#info').hidden ^= true;
    $('#apply-mask').onclick = () =>
        $$('[data-mask]').forEach(e => e.classList.toggle('mask'));

    const worker = fn => {
        const u = URL.createObjectURL(new Blob([
            `onmessage = async ({ data }) => postMessage(await (${fn})(data))`
        ]));
        const w = new Worker(u);
        return {
            run(a) {
                w.postMessage(a);
                return new Promise((res, rej) => {
                    w.onmessage = ({ data }) => res(data);
                    w.onerror = err => rej(err);
                });
            },
            dispose() {
                w.terminate();
                URL.revokeObjectURL(u);
            }
        };
    };

    const limitEval = (code, time = 5000) => {
        const f = worker(code);
        console.time('execute');
        return Promise.race([f.run(), delay(time)]).finally(() => {
            console.timeEnd('execute');
            f.dispose();
        });
    };

    const USER_REPO = 'garychowcmu/daizhigev20';
    const loadDirTo = async (root, dir = '') => {
        root.classList.add('loading');
        const headers = {};
        if (l.githubToken) headers.Authorization = `token ${l.githubToken}`;
        const url = `https://api.github.com/repos/${USER_REPO}/contents${dir}`;
        const res = await fetch(url, { headers });
        const json = await res.json();
        root.classList.remove('loading');
        const prev = root.previousElementSibling;
        if (prev.tagName === 'SUMMARY')
            prev.dataset.size = json.length;
        refreshRateLimit();
        for (const { name, type } of json) {
            if (name.startsWith('_') || name.endsWith('.md')) continue;
            if (type === 'file') {
                const a = document.createElement('a');
                a.classList.add('file');
                a.target = '_blank';
                a.textContent = name;
                a.href = `https://garychowcmu.github.io/daizhigev20${dir}/${name}`;
                root.appendChild(a);
            } else if (type === 'dir') {
                const details = document.createElement('details');
                const summary = document.createElement('summary');
                const section = document.createElement('section');
                summary.textContent = name;
                summary.onclick = () => {
                    summary.onclick = null;
                    summary.classList.add('opened');
                    loadDirTo(section, `${dir}/${name}`);
                };
                details.appendChild(summary);
                details.appendChild(section);
                root.appendChild(details);
            }
        }
    };

    $('#search').onclick = () =>
        window.open($('#search').dataset.href, '_blank').focus();

    loadDirTo($('#tree'));
})();