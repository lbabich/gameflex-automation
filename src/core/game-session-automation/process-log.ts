const GSA_LOG_PREFIX = '[gsa:log] ';

function log(context: string, message: string): void {
  process.stderr.write(`${GSA_LOG_PREFIX}[${context}] ${message}\n`);
}

export const processLog = { log };
