# Configuration Guide

This project uses external configuration files to manage sensitive information and deployment settings.

## Setup

1. **Copy the configuration template:**
   ```bash
   cp config.env.template config.env
   ```

2. **Edit the configuration file:**
   ```bash
   nano config.env  # or use your preferred editor
   ```

3. **Fill in your values:**
   - `BILLING_ACCOUNT`: Your GCP billing account ID
   - `PROJECT_NAME`: Base name for your GCP project
   - `REGION`: GCP region for deployment
   - `FIREBASE_APP_NAME`: Display name for your Firebase app
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `TARGET_API`: Your Google Apps Script API endpoint
   - `SHEET_URL`: Your Google Sheets URL
   - `ORG_ID`: (Optional) Your GCP organization ID

## Security

- The `config.env` file is excluded from git (see `.gitignore`)
- Never commit sensitive information to version control
- Keep your `config.env` file secure and don't share it

## Running the Setup

After configuring your `config.env` file, run the setup script:

```bash
./setup_infra.sh
```

The script will:
- Validate that all required configuration is present
- Create your GCP project
- Deploy the infrastructure
- Set up Firebase hosting
- Deploy your application

## Configuration Variables

### Required Variables
- `BILLING_ACCOUNT`: GCP billing account ID
- `PROJECT_NAME`: Base project name (timestamp will be added)
- `REGION`: GCP region for deployment
- `FIREBASE_APP_NAME`: Firebase app display name
- `OPENAI_API_KEY`: OpenAI API key for the service
- `TARGET_API`: Google Apps Script API endpoint
- `SHEET_URL`: Google Sheets URL

### Optional Variables
- `ORG_ID`: GCP organization ID (if you have one)

## Troubleshooting

If you get configuration errors:
1. Ensure `config.env` exists and is properly formatted
2. Check that all required variables are set
3. Verify your API keys are valid
4. Make sure your GCP billing account is active
