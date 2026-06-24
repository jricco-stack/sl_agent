// NRA casual dining industry benchmarks (National Restaurant Association)
const BENCHMARKS = {
    food_cost_pct:     { low: 0.28, high: 0.32, label: "Food Cost %" },
    labor_cost_pct:    { low: 0.28, high: 0.35, label: "Labor Cost %" },
    prime_cost_pct:    { low: 0.55, high: 0.65, label: "Prime Cost % (food + labor)" },
    rent_pct:          { low: 0.05, high: 0.10, label: "Rent % of Revenue" },
    beverage_cost_pct: { low: 0.18, high: 0.24, label: "Beverage Cost %" },
    supplies_pct:      { low: 0.01, high: 0.03, label: "Paper & Supplies %" },
};

export function compareToBenchmark(metric, actual) {
    const bench = BENCHMARKS[metric];
    if (!bench || actual == null) return null;

    const midpoint = (bench.low + bench.high) / 2;
    let status;
    if (actual < bench.low) status = "below";
    else if (actual > bench.high) status = "above";
    else status = "within";

    return {
        metric,
        label: bench.label,
        actual: `${(actual * 100).toFixed(1)}%`,
        benchmark: `${(bench.low * 100).toFixed(1)}–${(bench.high * 100).toFixed(1)}%`,
        status,
        delta_from_midpoint: `${((actual - midpoint) * 100).toFixed(1)}%`,
    };
}

export function benchmarkSummary(researchData) {
    const results = [];

    const foodCost = researchData.find(r => r.type === "food_cost");
    if (foodCost && foodCost.data.length === 2) {
        const theoretical = foodCost.data[0][1];
        const actual = foodCost.data[1][1];
        if (theoretical > 0) {
            const comparison = compareToBenchmark("food_cost_pct", actual / theoretical);
            if (comparison) results.push(comparison);
        }
    }

    return results;
}
