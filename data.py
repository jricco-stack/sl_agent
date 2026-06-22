import json

def data():

    # This is POS data, we get this from Toast POS reports, and it includes sales by meal period, item performance, server performance, etc.


    bucket_1 = {
        "A": {
            "pos_reports": {
                "daily_sales_by_weekday": [],  # list[dict] of weekday and sales totals
                "sales_by_meal_period": {},  # dict[str, float]
                "sales_by_revenue_center": {},  # dict[str, float]
                "hourly_sales_breakdown": [],  # list[dict] of hour and sales
                "covers_by_service": {},  # dict[str, int]
                "average_check_size": {},  # dict[str, float] by period or service
                "table_turn_times": [],  # list[float] or list[dict]
                "void_and_comp_reports": [],  # list[dict]
                "sales_performance_by_server": [],  # list[dict]
                "split_tender_reports": {},  # dict[str, float]
            }
        },
        "B": {
            "menu_performance": {
                "sales_mix": [],  # list[dict] with item, quantity, price
                "contribution_margin": [],  # list[dict] with item and margin
                "top_bottom_sellers": {
                    "top": [],  # list[dict]
                    "bottom": []  # list[dict]
                },
                "seasonal_margin_impact": [],  # list[dict]
                "promotion_sales": [],  # list[dict]
                "upsell_attachment_rates": {},  # dict[str, float]
            }
        },
        "C": {
            "third_party_delivery": {
                "gross_sales_by_platform": {},  # dict[str, float]
                "commission_fees": {},  # dict[str, float]
                "net_revenue_by_platform": {},  # dict[str, float]
                "average_order_size_comparison": {},  # dict[str, float]
                "refund_cancellation_rates": {},  # dict[str, float]
                "pricing_strategy_notes": "",  # str
                "gift_card_liability": 0.0,  # float
            }
        },
        "D": {
            "catering_and_events": {
                "events_per_month": 0,  # int
                "average_event_revenue": 0.0,  # float
                "event_food_costs": [],  # list[dict]
                "event_labor_costs": [],  # list[dict]
            }
        }
    }

    # This is labor, we get this from Toast payroll and scheduling reports, and it includes gross payroll, labor cost percent, scheduling adherence, staffing profiles, management structure, etc.
    bucket_2 = {
        "A": {
            "payroll_records": {
                "gross_payroll_by_period": [],  # list[dict]
                "payroll_by_role": {},  # dict[str, float]
                "hourly_rates_by_role": {},  # dict[str, float]
                "overtime_hours_and_costs": [],  # list[dict]
                "department_hours_by_week": {},  # dict[str, float]
                "labor_cost_percent_by_shift": [],  # list[dict]
                "minimum_wage_credit_adjustments": [],  # list[dict]
                "pto_sick_accrual": {},  # dict[str, float]
                "family_owner_payroll_leak": [],  # list[dict]
            }
        },
        "B": {
            "scheduling_timecards": {
                "master_schedules": [],  # list[dict]
                "scheduled_vs_actual_hours": [],  # list[dict]
                "clock_entries": [],  # list[dict]
                "unauthorized_shift_drift": [],  # list[dict]
                "shift_structure": [],  # list[dict]
            }
        },
        "C": {
            "staffing_profile_retention": {
                "headcount_by_role": {},  # dict[str, int]
                "tenure_by_employee": [],  # list[dict]
                "turnover_rate_12mo": 0.0,  # float
                "replacement_costs_by_role": {},  # dict[str, float]
                "reported_tips": {},  # dict[str, float]
            }
        },
        "D": {
            "management_footprint": {
                "owner_hours_per_week": 0.0,  # float
                "manager_compensation_structure": {},  # dict[str, str] or dict[str, float]
                "managers_scheduled_per_shift": [],  # list[dict]
            }
        }
    }

    # This we probably have to clean, but it includes all the data related to our suppliers, inventory, and cost of goods sold, such as invoices, delivery schedules, price changes, waste logs, inventory counts, etc.
    bucket_3 = {
        "A": {
            "supplier_invoices": {
                "invoice_line_items": [],  # list[dict]
                "delivery_frequency": {},  # dict[str, str]
                "monthly_spend_by_supplier": {},  # dict[str, float]
                "price_creep_tracking": [],  # list[dict]
                "surcharges_and_minimum_drop_fees": [],  # list[dict]
                "ingredient_specifications": [],  # list[dict]
            }
        },
        "B": {
            "beverage_program_invoices": {
                "alcohol_costs": {},  # dict[str, float]
                "non_alcoholic_costs": {},  # dict[str, float]
                "beverage_cost_percent": {},  # dict[str, float]
            }
        },
        "C": {
            "supplies_disposables": {
                "packaging_costs": [],  # list[dict]
                "cleaning_supplies_costs": [],  # list[dict]
                "smallwares_and_uniforms": [],  # list[dict]
            }
        },
        "D": {
            "inventory_management": {
                "beginning_inventory": {},  # dict[str, float]
                "ending_inventory": {},  # dict[str, float]
                "waste_gap_logs": [],  # list[dict]
                "kitchen_waste_logs": [],  # list[dict]
                "employee_meal_costs": [],  # list[dict]
            }
        },
        "E": {
            "supplier_contracts_terms": {
                "active_contracts": [],  # list[dict]
                "pricing_structure": {},  # dict[str, str]
                "payment_terms": {},  # dict[str, str]
                "backup_supplier_quotes": [],  # list[dict]
            }
        }
    }

    # This we get from store finances and includes all fixed and variable costs outside of COGS and labor, such as rent, utilities, insurance, marketing, technology, administrative expenses, etc.
    bucket_4 = {
        "A": {
            "occupancy_costs": {
                "base_rent": 0.0,  # float
                "lease_expiration": "",  # str or datetime
                "cam_charges": 0.0,  # float
                "property_tax_pass_through": 0.0,  # float
                "rent_as_percent_revenue": 0.0,  # float
            }
        },
        "B": {
            "utilities": {
                "electric_history": [],  # list[dict]
                "gas_history": [],  # list[dict]
                "water_sewer_history": [],  # list[dict]
                "connectivity_costs": {},  # dict[str, float]
                "trash_disposal_fees": [],  # list[dict]
                "utility_percent_of_revenue": 0.0,  # float
            }
        },
        "C": {
            "facility_equipment_operations": {
                "equipment_inventory": [],  # list[dict]
                "equipment_age_warranty": [],  # list[dict]
                "lease_finance_payments": [],  # list[dict]
                "maintenance_contracts": [],  # list[dict]
                "repair_cost_history": [],  # list[dict]
                "pos_hardware_leases": {},  # dict[str, float]
            }
        },
        "D": {
            "insurance_compliance": {
                "general_liability": 0.0,  # float
                "workers_compensation": 0.0,  # float
                "property_insurance": 0.0,  # float
                "liquor_liability": 0.0,  # float
            }
        },
        "E": {
            "marketing_technology": {
                "ad_spend": [],  # list[dict]
                "website_hosting_fees": 0.0,  # float
                "reservation_fees": {},  # dict[str, float]
                "online_ordering_costs": {},  # dict[str, float]
                "loyalty_marketing_subscriptions": [],  # list[dict]
                "linen_uniform_contracts": [],  # list[dict]
            }
        },
        "F": {
            "administrative_debt_services": {
                "accounting_fees": 0.0,  # float
                "legal_fees": 0.0,  # float
                "payroll_processing_fees": 0.0,  # float
                "merchant_processing_fees": 0.0,  # float
                "license_permit_costs": [],  # list[dict]
                "debt_service_details": [],  # list[dict]
            }
        }
    }

    return json.dumps({
        "bucket_1": bucket_1,
        "bucket_2": bucket_2,
        "bucket_3": bucket_3,
        "bucket_4": bucket_4
    })

if __name__ == "__main__":
    print(data())