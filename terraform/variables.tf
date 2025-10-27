variable "project_id" {}
variable "region" { default = "us-central1" }
variable "openai_api_key" {
  description = "Your OpenAI API key (temporary injection to Secret Manager)"
  sensitive   = true
}
variable "crud_endpoint_url" {
  description = "URL of the CRUD endpoint (Google Apps Script)"
  default     = ""
}
variable "second_endpoint_url" {
  description = "URL of the second endpoint called by extractDates (Google Apps Script for payroll processing)"
  default     = ""
}
variable "allowed_origins" {
  description = "Comma-separated list of allowed origins for CORS"
  default     = ""
}
variable "allowed_emails" {
  description = "Comma-separated list of allowed email addresses for Firebase authentication"
  default     = ""
}
