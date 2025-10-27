terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  required_version = ">= 1.5"
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
    ingress_settings   = "ALLOW_ALL"

    # Pass environment variables
    environment_variables = {
      ALLOWED_ORIGINS      = var.allowed_origins
      ALLOWED_EMAILS       = var.allowed_emails
      SECOND_ENDPOINT_URL = var.second_endpoint_url
    }

    # Securely inject secret
    secret_volumes {
      mount_path = "/etc/secrets"
      project_id = var.project_id
      secret     = google_secret_manager_secret.openai_secret.secret_id
    }
  }
}

# Allow unauthenticated invocations for extract_dates function
# Note: Managed via gcloud command to use roles/run.invoker instead of roles/cloudfunctions.invoker

# CRUD Cloud Function
resource "google_cloudfunctions2_function" "crud" {
  name        = "crud"
  location    = var.region
  description = "Employee CRUD operations"

  build_config {
    runtime     = "nodejs20"
    entry_point = "crud"
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
    ingress_settings   = "ALLOW_ALL"
    
    # Pass environment variables
    environment_variables = {
      CRUD_ENDPOINT_URL = var.crud_endpoint_url
      ALLOWED_ORIGINS   = var.allowed_origins
      ALLOWED_EMAILS    = var.allowed_emails
    }
  }
}

# IAM bindings: Allow public access to functions
# Functions handle authentication via Firebase ID tokens in code and check email allowlist
# Note: Cloud Functions v2 are deployed as Cloud Run services with lowercase service names
resource "google_cloud_run_service_iam_member" "extract_dates_public_access" {
  location = google_cloudfunctions2_function.extract_dates.location
  service  = "extractdates"  # Actual Cloud Run service name (lowercase)
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_service_iam_member" "crud_public_access" {
  location = google_cloudfunctions2_function.crud.location
  service  = "crud"
  role     = "roles/run.invoker"
  member   = "allUsers"
}
