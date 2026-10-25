// Fail closed: never fall back to the application's DATABASE_URL or .env.
const raw = process.env.M04_TEST_DATABASE_URL;
const fail = () => { throw new Error('M04 PostgreSQL tests require M04_TEST_DATABASE_URL for a local campusjob_m04_test database (schema public). See docs/testing/M04_SPRINT3.md.'); };
if (!raw) fail();
let url;
try { url = new URL(raw); } catch { fail(); }
if (!['postgresql:', 'postgres:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/campusjob_m04_test' ||
    (url.searchParams.get('schema') || 'public') !== 'public' ||
    url.searchParams.has('options')) fail();
process.env.DATABASE_URL = raw;
process.env.NODE_ENV = 'test';
