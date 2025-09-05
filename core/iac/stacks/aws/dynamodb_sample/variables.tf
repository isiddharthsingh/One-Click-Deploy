variable "table_name" {
  type        = string
  description = "DynamoDB table name"
}

variable "tags" {
  type        = map(string)
  description = "Tags"
  default     = {}
}


