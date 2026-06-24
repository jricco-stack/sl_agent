import json
import data

all_data = json.loads(data.data())
bucket_1 = all_data["bucket_1"]

def menu_engineering():
    pos_reports = bucket_1['A']['pos_reports']
    menu_performance = bucket_1['B']['menu_performance']

    sales_by_meal_period = pos_reports.get('sales_by_meal_period', {})
    contribution_margin = menu_performance.get('contribution_margin', {})

    if not contribution_margin:
        return json.dumps([])

    items = [
        {"name": name, "margin": margin, "sales": sales_by_meal_period.get(name, 0)}
        for name, margin in contribution_margin.items()
    ]

    avg_margin = sum(i["margin"] for i in items) / len(items)
    avg_sales = sum(i["sales"] for i in items) / len(items)

    def classify(item):
        high_margin = item["margin"] >= avg_margin
        high_sales = item["sales"] >= avg_sales
        if high_margin and high_sales:
            return "Star"
        elif high_margin and not high_sales:
            return "Puzzle"
        elif not high_margin and high_sales:
            return "Plow Horse"
        else:
            return "Dog"

    matrix = [
        [item["name"], item["margin"], item["sales"], classify(item)]
        for item in items
    ]

    return json.dumps(matrix)

if __name__ == "__main__":
    print(menu_engineering())
