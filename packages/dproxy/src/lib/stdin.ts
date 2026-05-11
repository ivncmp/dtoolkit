/**
 * Read piped stdin content, if available.
 * Returns an empty string when stdin is a TTY (interactive terminal).
 * Times out after 5 seconds to prevent hanging on broken pipes.
 */
export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return '';
  }

  return new Promise((resolve) => {
    let data = '';
    const timeout = setTimeout(() => resolve(data), 5000);
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}
