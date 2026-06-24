# Converts raw Toast API JSON exports into the data.py schema format.
# Call this once per sync cycle before running analysis scripts.

# Toast orders list -> bucket_1.A.pos_reports
def convert_orders_to_pos_reports(orders):
    sales_by_meal_period = {}
    for order in orders:
        period = order.get("mealPeriod", {}).get("name", "Unknown")
        total = order.get("totalAmount", 0)
        sales_by_meal_period[period] = sales_by_meal_period.get(period, 0) + total
    return {"sales_by_meal_period": sales_by_meal_period}

# Toast menu config -> bucket_1.B.menu_performance
def convert_menu_items_to_performance(menu_items):
    contribution_margin = {}
    for item in menu_items:
        name = item.get("name", "Unknown")
        price = item.get("price", 0)
        cost = item.get("cost", 0)
        contribution_margin[name] = price - cost
    return {"contribution_margin": contribution_margin}

# Toast time entries -> bucket_2.A.payroll_records
def convert_labor_to_payroll(labor_entries):
    payroll_by_role = {}
    for entry in labor_entries:
        role = entry.get("jobReference", {}).get("title", "Unknown")
        hours = entry.get("regularHours", 0)
        rate = entry.get("hourlyWage", 0)
        payroll_by_role[role] = payroll_by_role.get(role, 0) + (hours * rate)
    return {"payroll_by_role": payroll_by_role}

# Supplier invoice list -> bucket_3.A.supplier_invoices
def convert_invoices_to_supplier_data(invoices):
    invoice_line_items = []
    for invoice in invoices:
        for item in invoice.get("lineItems", []):
            invoice_line_items.append({
                "name": item.get("description", "Unknown"),
                "cost": item.get("amount", 0),
                "supplier": invoice.get("vendorName", "Unknown"),
            })
    return {"invoice_line_items": invoice_line_items}

if __name__ == "__main__":
    print("convertdata.py: import and call individual convert_* functions with your Toast API data.")
