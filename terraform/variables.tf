variable "project_id" {}
variable "region" { default = "us-central1" }
variable "openai_api_key" {
  description = "Your OpenAI API key (temporary injection to Secret Manager)"
  sensitive   = true
}
