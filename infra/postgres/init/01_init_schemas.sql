-- Create schemas for microservices boundaries
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS procurement;
CREATE SCHEMA IF NOT EXISTS production;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS audit;

-- Enable UUID extension just in case
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
