output "repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.app_repo.repository_url
}

output "repository_name" {
  description = "Name of the ECR repository"
  value       = aws_ecr_repository.app_repo.name
}

output "repository_arn" {
  description = "ARN of the ECR repository"
  value       = aws_ecr_repository.app_repo.arn
}
