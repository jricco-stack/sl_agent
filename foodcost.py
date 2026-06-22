# Theoretical vs Actual Food Cost Analysis
import json
import data

all_data = json.loads(data.data())
bucket_3 = all_data["bucket_3"]

def food_cost_analysis():
    matrix = []

    supplier_invoices = bucket_3['A']['supplier_invoices']

    total_theoretical_food_cost = sum(item['cost'] for invoice in supplier_invoices for item in invoice['line_items'])

    waste_logs = bucket_3['D']['inventory_management']['waste_gap_logs']
    kitchen_waste_logs = bucket_3['D']['inventory_management']['kitchen_waste_logs']

    total_actual_food_cost = sum(log['cost'] for log in waste_logs) + sum(log['cost'] for log in kitchen_waste_logs)

    print(f"Total Theoretical Food Cost: {total_theoretical_food_cost}")
    print(f"Total Actual Food Cost: {total_actual_food_cost}")

    matrix.append(['Theoretical Food Cost', total_theoretical_food_cost])
    matrix.append(['Actual Food Cost', total_actual_food_cost])

    return json.dumps(matrix)

if __name__ == "__main__":
    print(food_cost_analysis())
