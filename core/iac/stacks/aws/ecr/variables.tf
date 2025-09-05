variable "repository_name" {
  description = "Name of the ECR repository"
  type        = string
}

variable "enable_image_scanning" {
  description = "Enable image vulnerability scanning"
  type        = bool
  default     = true
}
