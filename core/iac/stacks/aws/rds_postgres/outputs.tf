output "database_url" {
  description = "PostgreSQL connection URL"
  # URL-encode credentials to avoid invalid DSN due to special characters
  value       = "postgresql://${urlencode(aws_db_instance.postgres.username)}:${urlencode(random_password.db_password.result)}@${aws_db_instance.postgres.endpoint}/${aws_db_instance.postgres.db_name}"
  sensitive   = true
}

output "endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "port" {
  description = "RDS instance port"
  value       = aws_db_instance.postgres.port
}

output "db_name" {
  description = "Database name"
  value       = aws_db_instance.postgres.db_name
}

output "username" {
  description = "Database username"
  value       = aws_db_instance.postgres.username
}

output "password" {
  description = "Database password"
  value       = random_password.db_password.result
  sensitive   = true
}
