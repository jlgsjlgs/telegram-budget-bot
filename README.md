# Telegram Budget Bot

A powerful personal expense tracking bot for Telegram that automatically logs your expenses to Google Sheets. Built with Cloudflare Workers and Google Apps Script for reliable, serverless operation.

## Features
- Simple Expense Logging: Add expenses with a single command
- Automatic Monthly Sheets: Creates new sheets for each month automatically
- Real-time Confirmation: Get instant feedback when expenses are logged
- Secure & Private: User authorization and webhook verification
- Serverless Architecture: No server maintenance required

## Architecture

Telegram → Cloudflare Workers → Google Apps Script → Google Sheets

- Cloudflare Workers: Handles Telegram webhook and user interactions
- Google Apps Script: Manages spreadsheet operations and data validation
- Google Sheets: Stores and organizes expense data by month

## Deployment

Telegram bot is deployed on Cloudfare Workers via Github Actions using [Wrangler](https://developers.cloudflare.com/workers/wrangler/)

## Environment Variables

These can be set through GitHub Actions secrets.

| Variable                | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `APPS_SCRIPT_URL`       | API endpoint URL for the deployed Google Apps Script          |
| `AUTHORIZED_USERS`      | Comma-separated list of authorized Telegram user IDs          |
| `BOT_TOKEN`             | Telegram bot token                                            |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID                                    |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token with Worker deployment permissions       |
| `SHARED_SECRET`         | Secret used for authentication between Cloudflare Workers and Google Apps Script |
| `WEBHOOK_SECRET`        | Secret used to verify Telegram webhook requests in Cloudflare Workers |
