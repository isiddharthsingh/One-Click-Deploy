output "alb_dns_name" {
  description = "Public DNS of the ALB"
  value       = aws_lb.this.dns_name
}

output "service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.this.name
}


