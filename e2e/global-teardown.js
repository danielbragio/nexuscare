import { execFile } from 'child_process';
import { stdout, stderr } from 'process';

export default async function globalTeardown() {
  await new Promise((resolve) => {
    execFile(
      'C:\\xampp\\php\\php.exe',
      ['C:\\xampp\\htdocs\\vynor-clinic-api\\scripts\\cleanup_qa_data.php', '--force'],
      { timeout: 30_000 },
      (err, out, err2) => {
        if (out)  stdout.write(out);
        if (err2) stderr.write(err2);
        if (err)  console.warn('[teardown] cleanup_qa_data.php saiu com erro:', err.message);
        resolve();
      }
    );
  });
}
