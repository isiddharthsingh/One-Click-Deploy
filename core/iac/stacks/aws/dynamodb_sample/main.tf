terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_dynamodb_table" "employee" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"

  hash_key = "LoginAlias"

  attribute {
    name = "LoginAlias"
    type = "S"
  }

  tags = var.tags
}

# Seed a few example items used by the sample app's /dynamodb page
resource "aws_dynamodb_table_item" "seed_1" {
  table_name = aws_dynamodb_table.employee.name
  hash_key   = aws_dynamodb_table.employee.hash_key
  item       = jsonencode({
    LoginAlias = { S = "jdoe" }
    FirstName  = { S = "John" }
    LastName   = { S = "Doe" }
    Skills     = { S = "Flask, Boto3" }
  })
}

resource "aws_dynamodb_table_item" "seed_2" {
  table_name = aws_dynamodb_table.employee.name
  hash_key   = aws_dynamodb_table.employee.hash_key
  item       = jsonencode({
    LoginAlias = { S = "jsmith" }
    FirstName  = { S = "Jane" }
    LastName   = { S = "Smith" }
    Skills     = { S = "AWS, Python" }
  })
}


