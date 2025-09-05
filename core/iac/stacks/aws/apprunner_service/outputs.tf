output "service_url" {
  description = "URL of the App Runner service"
  value       = "https://${aws_apprunner_service.app.service_url}"
}

output "service_arn" {
  description = "ARN of the App Runner service"
  value       = aws_apprunner_service.app.arn
}

output "service_id" {
  description = "ID of the App Runner service"
  value       = aws_apprunner_service.app.service_id
}

output "service_status" {
  description = "Status of the App Runner service"
  value       = aws_apprunner_service.app.status
}
