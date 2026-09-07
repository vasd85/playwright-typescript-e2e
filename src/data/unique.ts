// One id per process: a restarted worker is a new process and gets a new one.
const RUN_ID = Date.now().toString(36);
let counter = 0;

/** Unique per run, per worker slot and per call: `<run>w<slot>n<counter>`, letters and digits only. */
export function uniqueId(slot: number): string {
  counter += 1;
  return `${RUN_ID}w${slot}n${counter}`;
}
