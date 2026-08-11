import { runStage2Backtests } from "../lib/stage2-backtest";

const result = runStage2Backtests();
console.log(JSON.stringify(result, null, 2));
if (!result.activationReady) process.exitCode = 1;
