variable "service_name" {
  description = "Name of the App Runner service"
  type        = string
}

variable "image_uri" {
  description = "URI of the container image"
  type        = string
}

variable "port" {
  description = "Port that the application listens on"
  type        = number
  default     = 8080
}

variable "env_vars" {
  description = "Environment variables for the application"
  type        = map(string)
  default     = {}
}

variable "cpu" {
  description = "Number of CPU units for the service (0.25 vCPU, 0.5 vCPU, 1 vCPU, 2 vCPU)"
  type        = string
  default     = "0.25 vCPU"
}

variable "memory" {
  description = "Amount of memory for the service (0.5 GB, 1 GB, 2 GB, 3 GB, 4 GB)"
  type        = string
  default     = "0.5 GB"
}

variable "health_check_path" {
  description = "Path for health check"
  type        = string
  default     = "/"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
