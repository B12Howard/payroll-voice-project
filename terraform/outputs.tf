output "function_url" {
  value = "https://${google_cloudfunctions2_function.extract_dates.location}-${var.project_id}.cloudfunctions.net/${google_cloudfunctions2_function.extract_dates.name}"
}

output "crud_function_url" {
  value = "https://${google_cloudfunctions2_function.crud.location}-${var.project_id}.cloudfunctions.net/${google_cloudfunctions2_function.crud.name}"
}

output "project_id" {
  value = var.project_id
}
