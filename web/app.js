// Tab navigation
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
});

// Load everything on page load
async function loadDashboard() {
    try {
        const res  = await fetch("/api/analysis");
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const data = await res.json();
        renderOverview(data);
        renderMenuEngineering(data.menu_matrix);
        renderFoodCost(data.food_cost, data.benchmarks);
        renderAlerts(data.operational_alerts);
    } catch (err) {
        console.error("Failed to load dashboard:", err);
        showError("Could not connect to the API. Make sure the server is running.");
    }
}

function showError(msg) {
    ["insights-list", "recommendations-list", "alerts-list"].forEach(id => {
        document.getElementById(id).innerHTML = `<li class="error">${msg}</li>`;
    });
    ["stars-list", "puzzles-list", "plow-horses-list", "dogs-list"].forEach(id => {
        document.getElementById(id).innerHTML = `<li class="error">No data</li>`;
    });
    document.getElementById("benchmarks-body").innerHTML =
        `<tr><td colspan="4" class="error">${msg}</td></tr>`;
}

function renderOverview(data) {
    const ai = data.ai || {};

    const statusEl = document.getElementById("prime-cost-status");
    statusEl.textContent = ai.prime_cost_status || "unknown";
    statusEl.className   = "value " + (ai.prime_cost_status || "unknown");

    // Food cost variance — how much actual differs from theoretical
    const fc = data.food_cost;
    if (fc && fc.theoretical > 0) {
        const variance = ((fc.actual - fc.theoretical) / fc.theoretical * 100).toFixed(1);
        const sign = variance > 0 ? "+" : "";
        document.getElementById("food-cost-pct").textContent = `${sign}${variance}%`;
    }

    document.getElementById("alert-count").textContent =
        (data.operational_alerts || []).length;

    document.getElementById("insights-list").innerHTML =
        (ai.insights && ai.insights.length > 0)
            ? ai.insights.map(i => `<li>${i}</li>`).join("")
            : "<li class='empty'>No insights yet — connect your Toast data to get started.</li>";

    document.getElementById("recommendations-list").innerHTML =
        (ai.recommendations && ai.recommendations.length > 0)
            ? ai.recommendations.map(r => `<li>${r}</li>`).join("")
            : "<li class='empty'>No recommendations yet.</li>";
}

function renderMenuEngineering(matrix) {
    const lists = {
        "Star":       "stars-list",
        "Puzzle":     "puzzles-list",
        "Plow Horse": "plow-horses-list",
        "Dog":        "dogs-list",
    };

    // Clear loading state
    Object.values(lists).forEach(id => {
        document.getElementById(id).innerHTML = "";
    });

    if (!matrix || matrix.length === 0) {
        Object.values(lists).forEach(id => {
            document.getElementById(id).innerHTML = "<li class='empty'>No menu data yet.</li>";
        });
        return;
    }

    matrix.forEach(item => {
        const listId = lists[item.category];
        if (!listId) return;
        const li = document.createElement("li");
        li.textContent = `${item.name} (margin: $${item.margin.toFixed(2)})`;
        document.getElementById(listId).appendChild(li);
    });

    // Fill any empty quadrants
    Object.values(lists).forEach(id => {
        const el = document.getElementById(id);
        if (el.children.length === 0) {
            el.innerHTML = "<li class='empty'>None</li>";
        }
    });
}

let foodCostChart = null;

function renderFoodCost(foodCost, benchmarks) {
    // Destroy previous chart if re-rendering
    if (foodCostChart) foodCostChart.destroy();

    const ctx = document.getElementById("food-cost-chart").getContext("2d");

    if (!foodCost || (foodCost.theoretical === 0 && foodCost.actual === 0)) {
        document.getElementById("food-cost-chart-wrap").innerHTML =
            "<p class='empty' style='padding:20px'>No food cost data yet.</p>";
    } else {
        foodCostChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: ["Theoretical Cost", "Actual Cost"],
                datasets: [{
                    label: "Cost ($)",
                    data: [foodCost.theoretical, foodCost.actual],
                    backgroundColor: ["#4a90e2", foodCost.actual > foodCost.theoretical ? "#e05c5c" : "#27ae60"],
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } },
            }
        });
    }

    // Benchmarks table
    const tbody = document.getElementById("benchmarks-body");
    if (!benchmarks || benchmarks.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4' class='empty'>No benchmark data yet.</td></tr>";
    } else {
        tbody.innerHTML = benchmarks.map(b => `
            <tr class="status-${b.status}">
                <td>${b.label}</td>
                <td>${b.actual}</td>
                <td>${b.benchmark}</td>
                <td>${b.status}</td>
            </tr>
        `).join("");
    }
}

function renderAlerts(alerts) {
    document.getElementById("alerts-list").innerHTML =
        (alerts && alerts.length > 0)
            ? alerts.map(a => `<li class="alert-item">${a}</li>`).join("")
            : "<li class='empty'>No active alerts.</li>";
}

// Q&A chat
document.getElementById("chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input    = document.getElementById("chat-input");
    const question = input.value.trim();
    if (!question) return;

    appendMessage("you", question);
    input.value = "";

    try {
        const res  = await fetch("/api/question", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ question }),
        });
        const data = await res.json();
        appendMessage("bot", data.answer || "No answer returned.");
    } catch (err) {
        appendMessage("bot", "Sorry, something went wrong reaching the server.");
    }
});

function appendMessage(sender, text) {
    const messages = document.getElementById("chat-messages");
    const div = document.createElement("div");
    div.className   = `message ${sender}`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

loadDashboard();
