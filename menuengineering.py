import data

bucket_1 = data.data()["bucket_1"]
bucket_2 = data.data()["bucket_2"]
bucket_3 = data.data()["bucket_3"]
bucket_4 = data.data()["bucket_4"]

def menu_engineering():
    # This function will perform menu engineering analysis using the data from the buckets.
    # For example, we can analyze sales by meal period, item popularity, and contribution margin.

    matrix = []

    # Accessing POS reports from bucket 1
    pos_reports = bucket_1['A']['pos_reports']
    menu_performance = bucket_1['B']['menu_performance']
    
    # Example: Calculate total sales by meal period
    sales_by_meal_period = pos_reports.get('sales_by_meal_period', {})
    
    # Example: Calculate contribution margin for each menu item
    contribution_margin = menu_performance.get('contribution_margin', {})
    
    # Further analysis can be performed here based on the available data in the buckets.
    for item in contribution_margin:
        margin = contribution_margin[item]
        print(f"Item: {item}, Contribution Margin: {margin}")
        matrix.append([item, margin, sales_by_meal_period.get(item, 0)])


    return matrix