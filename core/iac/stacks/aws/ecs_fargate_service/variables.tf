variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "service_name" {
  type        = string
  description = "ECS service name"
}

variable "image_uri" {
  type        = string
  description = "Container image URI"
}

variable "container_port" {
  type        = number
  description = "Container port"
  default     = 8080
}

variable "health_check_path" {
  type        = string
  description = "Health check path"
  default     = "/"
}

variable "cpu" {
  type        = string
  description = "CPU for task definition"
  default     = "256"
}

variable "memory" {
  type        = string
  description = "Memory for task definition"
  default     = "512"
}

variable "desired_count" {
  type        = number
  description = "Desired task count"
  default     = 1
}

variable "env_vars" {
  type        = map(string)
  description = "Environment variables"
  default     = {}
}

variable "tags" {
  type        = map(string)
  description = "Tags"
  default     = {}
}


