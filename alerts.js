// Threshold-based alert logic — returns array of alert strings ready to post to Slack
export function checkAlerts(researchData) {
    const alerts = [];

    const foodCost = researchData.find(r => r.type === "food_cost");
    if (foodCost && foodCost.data.length === 2) {
        const theoretical = foodCost.data[0][1];
        const actual = foodCost.data[1][1];
        if (theoretical > 0) {
            const pct = actual / theoretical;
            if (pct > 0.35) {
                const extraCost = Math.round((pct - 0.30) * theoretical);
                alerts.push(`Food cost is at ${(pct * 100).toFixed(1)}% — above the 32% benchmark. At current volume that's roughly $${extraCost.toLocaleString()} extra spend this period.`);
            }
        }
    }

    const menuData = researchData.find(r => r.type === "menu_engineering");
    if (menuData && menuData.data.length > 0) {
        const dogs = menuData.data.filter(row => row[3] === "Dog");
        if (dogs.length > 0) {
            alerts.push(`${dogs.length} menu item(s) flagged as Dogs (low margin + low sales): ${dogs.map(d => d[0]).join(", ")}. Consider removing or repricing.`);
        }
        const puzzles = menuData.data.filter(row => row[3] === "Puzzle");
        if (puzzles.length > 0) {
            alerts.push(`${puzzles.length} menu item(s) are Puzzles (high margin but low sales): ${puzzles.map(p => p[0]).join(", ")}. Better placement or promotion could move these.`);
        }
    }

    const benchmarkData = researchData.find(r => r.type === "benchmarks");
    if (benchmarkData) {
        for (const b of benchmarkData.data) {
            if (b.status === "above") {
                alerts.push(`${b.label} is ${b.actual} — above the industry range of ${b.benchmark} (${b.delta_from_midpoint} over midpoint).`);
            }
        }
    }

    return alerts;
}
