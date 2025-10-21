terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  required_version = ">= 1.6"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ------------------------
# Secret Manager: Create secret
# ------------------------
resource "google_secret_manager_secret" "openai_secret" {
  secret_id = "openai-api-key"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "openai_secret_version" {
  secret      = google_secret_manager_secret.openai_secret.id
  secret_data = var.openai_api_key
}

# ------------------------
# Bucket for function source
# ------------------------
resource "google_storage_bucket" "function_bucket" {
  name          = "${var.project_id}-functions"
  location      = var.region
  force_destroy = true
}

resource "google_storage_bucket_object" "function_zip" {
  name   = "extractDates.zip"
  bucket = google_storage_bucket.function_bucket.name
  source = "function_source/extractDates.zip"
}

# ------------------------
# Cloud Function
# ------------------------
resource "google_cloudfunctions2_function" "extract_dates" {
  name        = "extractDates"
  location    = var.region
  description = "Extract date ranges via OpenAI"

  build_config {
    runtime     = "nodejs20"
    entry_point = "extractDates"
    source {
      storage_source {
        bucket = google_storage_bucket.function_bucket.name
        object = google_storage_bucket_object.function_zip.name
      }
    }
  }

  service_config {
    max_instance_count = 2
    available_memory   = "256M"
    timeout_seconds    = 60
    ingress_settings   = "ALLOW_INTERNAL_AND_GCLB"

    # Securely inject secret
    secret_volumes {
      mount_path = "/etc/secrets"
      project_id = var.project_id
      secret     = google_secret_manager_secret.openai_secret.secret_id
    }
  }
}

output "function_url" {
  value = google_cloudfunctions2_function.extract_dates.service_config[0].uri
}
