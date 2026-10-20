import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const setupSql = await fs.readFile(new URL('../../supabase/setup-site-rebuilds.sql', import.meta.url), 'utf8');
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema net; create schema cron; create schema vault;
    create table public.places(id int primary key, name text);
    create table vault.decrypted_secrets(name text, decrypted_secret text);
    insert into vault.decrypted_secrets values('site_build_github_token','github_pat_test_fixture_not_a_real_token');
    create table net.requests(id bigserial primary key, url text, headers jsonb, body jsonb);
    create table net._http_response(id bigint primary key, status_code int, timed_out boolean);
    create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 1000) returns bigint language plpgsql as $$
    declare request bigint; begin insert into net.requests(url, headers, body) values(url, headers, body) returning id into request; return request; end $$;
    create table cron.jobs(name text primary key, schedule text, command text);
    create function cron.schedule(job_name text, schedule text, command text) returns bigint language plpgsql as $$ begin
    insert into cron.jobs values(job_name,schedule,command) on conflict(name) do update set schedule=excluded.schedule,command=excluded.command;
    return 1; end $$;`);
  await db.exec(setupSql);
  return db;
}
const queue = async db => (await db.query('select * from site_build_private.queue')).rows[0];
async function ready(db) {
  await db.exec("insert into public.places values(1,'Moss'); update site_build_private.queue set dirty_at = clock_timestamp() - interval '1 minute'; select site_build_private.dispatch();");
}

test('site rebuilds combine bulk changes and wait for a quiet period', async () => {
  const db = await database();
  try {
    await db.exec("insert into public.places values(1,'A'),(2,'B'),(3,'C'); select site_build_private.dispatch();");
    assert.equal((await db.query('select count(*)::int as count from net.requests')).rows[0].count, 0);
    assert.ok((await queue(db)).dirty_at);
    await db.exec("update site_build_private.queue set dirty_at = clock_timestamp() - interval '1 minute'; select site_build_private.dispatch(); select site_build_private.dispatch();");
    const requests = (await db.query('select url, body from net.requests')).rows;
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://api.github.com/repos/RuckusLabs/herbplaces/actions/workflows/deploy.yml/dispatches');
    assert.deepEqual(requests[0].body, { ref: 'main' });
  } finally { await db.close(); }
});
test('accepted dispatches clear the job, and later changes remain queued', async () => {
  const db = await database();
  try {
    await ready(db);
    await db.exec('insert into net._http_response values(1,204,false); select site_build_private.dispatch();');
    assert.equal((await queue(db)).dirty_at, null);
    assert.ok((await queue(db)).last_accepted_at);
    await db.exec("delete from public.places; update site_build_private.queue set dirty_at=clock_timestamp()-interval '1 minute'; select site_build_private.dispatch();");
    await db.exec("insert into public.places values(2,'Fern'); update site_build_private.queue set dirty_at=request_started_at+interval '1 second'; insert into net._http_response values(2,200,false); select site_build_private.dispatch();");
    assert.ok((await queue(db)).dirty_at);
    assert.equal((await queue(db)).request_id, null);
  } finally { await db.close(); }
});
test('failed requests retry with backoff without losing place changes', async () => {
  const db = await database();
  try {
    await ready(db);
    await db.exec('insert into net._http_response values(1,500,false); select site_build_private.dispatch();');
    assert.match((await queue(db)).last_error, /HTTP 500/);
    assert.ok((await queue(db)).dirty_at);
    assert.equal((await db.query('select count(*)::int as count from net.requests')).rows[0].count, 1);
    await db.exec("update site_build_private.queue set last_attempt_at=clock_timestamp()-interval '6 minutes'; select site_build_private.dispatch();");
    assert.equal((await db.query('select count(*)::int as count from net.requests')).rows[0].count, 2);
  } finally { await db.close(); }
});
test('missing credentials leave a pending job and do not prevent place edits', async () => {
  const db = await database();
  try {
    await db.exec("delete from vault.decrypted_secrets; insert into public.places values(1,'Moss'); update site_build_private.queue set dirty_at=clock_timestamp()-interval '1 minute'; select site_build_private.dispatch();");
    assert.match((await queue(db)).last_error, /missing from Vault/);
    assert.equal((await db.query('select name from public.places')).rows[0].name, 'Moss');
    assert.equal((await db.query('select count(*)::int as count from net.requests')).rows[0].count, 0);
  } finally { await db.close(); }
});
test('setup is repeatable and the queue and dispatch stay private', async () => {
  const db = await database();
  try {
    await db.exec(setupSql);
    assert.equal((await db.query('select count(*)::int as count from cron.jobs')).rows[0].count, 1);
    assert.equal((await db.query("select count(*)::int as count from pg_trigger where tgname='queue_site_rebuild' and not tgisinternal")).rows[0].count, 1);
    await db.exec('set role anon;');
    await assert.rejects(db.query('select * from site_build_private.queue'), /permission denied/);
    await assert.rejects(db.query('select site_build_private.dispatch()'), /permission denied/);
  } finally { await db.close(); }
});
