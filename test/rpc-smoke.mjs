#!/usr/bin/env node
// Deep pinned-pi smoke for clock-stamp. Drives a REAL agent turn with no
// external model: a local canned-SSE HTTP server stands in as an
// openai-completions provider (registered via test/mock-provider.ts), the
// RPC `prompt` verb runs a genuine turn, and the mock server captures the
// exact request body pi sent upstream — proving the "Now: YYYY-MM-DD
// HH:MM TZ" stamp injected by before_agent_start actually reaches the
// model payload, not just the extension's local copy of the prompt.
// Also asserts no extension_error events and a clean shutdown.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'pi-clock-stamp-deep-'));
const agentDir = join(dir, 'agent');
mkdirSync(join(agentDir, 'sessions', 'tmp'), { recursive: true });
writeFileSync(join(agentDir, 'settings.json'), JSON.stringify({ defaultProvider: 'mocktest', defaultModel: 'mock-model' }, null, 2) + '\n');
const BODY_CAPTURE = join(agentDir, 'llm-request.json');

// Canned openai-completions SSE: role delta -> content delta -> stop -> DONE.
// Every request body is captured to disk for the stamp assertion.
const chunk = (obj) => `data: ${JSON.stringify(obj)}\n\n`;
const server = createServer((req, res) => {
	let body = '';
	req.on('data', (d) => { body += d; });
	req.on('end', () => {
		try { writeFileSync(BODY_CAPTURE, body); } catch { /* non-fatal */ }
		res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
		res.write(chunk({ id: 'c1', object: 'chat.completion.chunk', created: 1, model: 'mock-model', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] }));
		res.write(chunk({ id: 'c1', object: 'chat.completion.chunk', created: 1, model: 'mock-model', choices: [{ index: 0, delta: { content: 'hello' }, finish_reason: null }] }));
		res.write(chunk({ id: 'c1', object: 'chat.completion.chunk', created: 1, model: 'mock-model', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }));
		res.write('data: [DONE]\n\n');
		res.end();
	});
});
server.listen(0, '127.0.0.1');
await new Promise((resolve) => server.on('listening', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;

// detached: true so the smoke owns the child's process group and the
// shutdown fallback can kill the whole tree (codex-accounts lesson: a
// stuck grandchild holding stdio turns an unbounded close wait into
// node exit 13, masking the real failure).
const child = spawn(
	process.env.PI_TEST_BIN ?? join(dirname(process.execPath), 'pi'),
	['--mode', 'rpc', '--no-extensions', '-e', join(root, 'index.js'), '-e', join(root, 'test', 'mock-provider.ts'), '--session-dir', join(agentDir, 'sessions', 'tmp')],
	{ env: { ...process.env, PI_CODING_AGENT_DIR: agentDir, MOCK_BASE_URL: baseUrl }, cwd: dir, stdio: ['pipe', 'pipe', 'pipe'], detached: true },
);
let out = '';
let err = '';
child.stdout.on('data', (d) => { out += d; });
child.stderr.on('data', (d) => { err += d; });

// pi RPC buffers stdin until ready, so send the probe immediately —
// waiting for output first is a deadlock (pi prints nothing on boot).
child.stdin.write(JSON.stringify({ type: 'get_commands', id: 'g1' }) + '\n');

const t0 = Date.now();
let phase = 'boot';
let promptSent = false;
const killTimer = setTimeout(() => child.kill('SIGKILL'), 90_000);
const poll = setInterval(() => {
	if (phase === 'boot' && out.length > 0) {
		phase = 'prompt';
		console.error('  pi RPC up; sending prompt');
		child.stdin.write(JSON.stringify({ type: 'prompt', id: 'p1', message: 'say hello' }) + '\n');
		promptSent = true;
	} else if (phase === 'prompt' && existsSync(BODY_CAPTURE)) {
		phase = 'done';
		clearInterval(poll);
		finish(true);
	} else if (Date.now() - t0 > (promptSent ? 45_000 : 20_000)) {
		clearInterval(poll);
		finish(false);
	}
}, 200);

function finish(ok) {
	child.stdin.end();
	// Bounded close wait with process-group SIGKILL fallback.
	const closeWait = new Promise((resolve) => {
		const killer = setTimeout(() => {
			try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* gone */ } }
			resolve();
		}, 5000);
		child.once('close', () => { clearTimeout(killer); resolve(); });
	});
	closeWait.then(() => {
		server.close();
		clearTimeout(killTimer);
		try {
			assert2(ok, `timed out at phase=${phase}; stderr tail: ${err.slice(-800)}`);
			const captured = JSON.parse(readFileSync(BODY_CAPTURE, 'utf8'));
			const sys = JSON.stringify(captured);
			assert2(/Now: \d{4}-\d{2}-\d{2} \d{2}:\d{2} [A-Z]{2,5}/.test(sys), `no Now: stamp in LLM request payload: ${sys.slice(0, 400)}`);
			assert2(!/"type":"extension_error"/.test(out), `extension_error seen: ${out.slice(-600)}`);
			assert2(/hello/.test(sys), `assistant context missing: ${sys.slice(0, 200)}`);
			console.log(`Deep smoke PASS: real turn driven; Now: stamp present in LLM request payload (${(Date.now() - t0) / 1000 | 0}s).`);
		} catch (e) {
			console.error('FAIL', e.message);
			console.error(`stdout tail: ${out.slice(-400)}`);
			process.exitCode = 1;
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
}
function assert2(cond, msg) { if (!cond) throw new Error(msg); }
