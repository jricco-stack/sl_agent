import json
import data

all_data = json.loads(data.data())
bucket_1 = all_data["bucket_1"]

def menu_engineering():
    matrix = []

    pos_reports = bucket_1['A']['pos_reports']
    menu_performance = bucket_1['B']['menu_performance']

    sales_by_meal_period = pos_reports.get('sales_by_meal_period', {})
    contribution_margin = menu_performance.get('contribution_margin', {})

    for item in contribution_margin:
        margin = contribution_margin[item]
        print(f"Item: {item}, Contribution Margin: {margin}")
        matrix.append([item, margin, sales_by_meal_period.get(item, 0)])

    return json.dumps(matrix)

if __name__ == "__main__":
    print(menu_engineering())
