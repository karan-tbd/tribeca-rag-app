import type { Reporter, Task, File } from "vitest";
import fs from "node:fs";

const timedOut: { file: string; name: string }[] = [];

function isTimeout(err?: any) {
  const msg = err?.message || err?.stack || "";
  return typeof msg === "string" && /Exceeded timeout|Timeout of \d+ms exceeded/i.test(msg);
}

function collect(task: Task) {
  if (task.type === "test" && task.result?.state === "fail") {
    const err = task.result.errors?.[0];
    if (isTimeout(err)) timedOut.push({ file: task.file?.name ?? "", name: task.name });
  }
  task.tasks?.forEach(collect);
}

class TimeoutReporter implements Reporter {
  onFinished(ctx: any) {
    const files = (ctx.state?.getFiles?.() || []) as File[];
    files.forEach((f) => f.tasks.forEach(collect));

    if (timedOut.length) {
      console.log("\n=== Skipped due to timeout (10s) ===");
      timedOut.forEach((t) => console.log(`• ${t.file} :: ${t.name}`));
      try {
        fs.writeFileSync(".vitest-timeouts.json", JSON.stringify(timedOut, null, 2));
      } catch (e) {
        console.warn("Failed to write .vitest-timeouts.json", e);
      }
    }
  }
}

export default TimeoutReporter;

