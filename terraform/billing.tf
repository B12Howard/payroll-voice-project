# Billing Budget Configuration
resource "google_billing_budget" "payroll_budget" {
  billing_account = var.billing_account_id
  display_name    = "Payroll Project Budget"

  budget_filter {
    projects = ["projects/${var.project_id}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = "50"  # $50 per month
    }
  }

  threshold_rules {
    threshold_percent = 0.5  # 50%
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.9  # 90%
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0  # 100%
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.5  # 150% (overage)
    spend_basis       = "CURRENT_SPEND"
  }

  all_updates_rule {
    monitoring_notification_channels = [
      google_monitoring_notification_channel.email.id
    ]
    disable_default_iam_recipients = false
  }
}

# Email notification channel
resource "google_monitoring_notification_channel" "email" {
  display_name = "Email Notification"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }
}

# Variables
variable "billing_account_id" {
  description = "GCP Billing Account ID"
  type        = string
}

variable "alert_email" {
  description = "Email address for billing alerts"
  type        = string
}
