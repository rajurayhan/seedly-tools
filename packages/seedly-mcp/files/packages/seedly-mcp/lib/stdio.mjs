import { handleJsonRpc } from './mcp-protocol.mjs';

export async function runStdio(exec, { stdin = process.stdin, stdout = process.stdout } = {}) {
  stdin.setEncoding('utf8');
  let buffer = Buffer.alloc(0);

  function writeMessage(message) {
    if (!message) return;
    const json = JSON.stringify(message);
    const frame = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
    stdout.write(frame);
  }

  async function consume(text) {
    buffer = Buffer.concat([buffer, Buffer.from(text, 'utf8')]);
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const header = buffer.subarray(0, headerEnd).toString('utf8');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.subarray(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const start = headerEnd + 4;
      if (buffer.length < start + length) return;
      const body = buffer.subarray(start, start + length).toString('utf8');
      buffer = buffer.subarray(start + length);
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        writeMessage({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        continue;
      }
      const reply = await handleJsonRpc(parsed, exec);
      writeMessage(reply);
    }
  }

  stdin.on('data', (chunk) => {
    consume(chunk).catch((err) => {
      writeMessage({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: err instanceof Error ? err.message : 'stdio failed' },
      });
    });
  });
}
