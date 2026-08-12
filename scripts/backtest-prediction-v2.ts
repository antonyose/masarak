import { writeFileSync } from "node:fs";
import path from "node:path";
import { runPredictionV2Backtests } from "../lib/prediction-v2/backtest";

const result = runPredictionV2Backtests();
const output = path.resolve(process.cwd(), "reports", "prediction-v2-backtest.json");
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ output, ...result.gates }, null, 2));
