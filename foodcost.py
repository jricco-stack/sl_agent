# Theoretical vs Actual Food Cost Analysis
import data

bucket_1 = data.data()["bucket_1"]
bucket_2 = data.data()["bucket_2"]
bucket_3 = data.data()["bucket_3"]
bucket_4 = data.data()["bucket_4"]

def food_cost_analysis():
    # This function will perform a theoretical vs actual food cost analysis using the data from the buckets.
    # For example, we can compare theoretical food costs based on recipes and portion sizes to actual food costs from inventory and waste logs.

    matrix = []

    # Accessing supplier invoices and inventory data from bucket 3
    supplier_invoices = bucket_3['A']['supplier_invoices']
    delivery_frequency = bucket_3['A']['delivery_frequency']
    
    # Example: Calculate total theoretical food cost based on supplier invoices
    total_theoretical_food_cost = sum(item['cost'] for invoice in supplier_invoices for item in invoice['line_items'])
    
    # Example: Calculate total actual food cost based on waste logs and inventory counts
    waste_logs = bucket_3['B']['waste_logs']
    inventory_counts = bucket_3['C']['inventory_counts']
    
    total_actual_food_cost = sum(log['cost'] for log in waste_logs) + sum(count['cost'] for count in inventory_counts)
    
    print(f"Total Theoretical Food Cost: {total_theoretical_food_cost}")
    print(f"Total Actual Food Cost: {total_actual_food_cost}")
    
    matrix.append(['Theoretical Food Cost', total_theoretical_food_cost])
    matrix.append(['Actual Food Cost', total_actual_food_cost])

    return matrix