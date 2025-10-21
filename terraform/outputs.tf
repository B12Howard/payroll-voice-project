output "function_url" {
  value = "https://${google_cloudfunctions2_function.extract_dates.location}-${var.project_id}.cloudfunctions.net/${google_cloudfunctions2_function.extract_dates.name}"
}

output "project_id" {
  value = var.project_id
}
