# Deployment Guide

This document describes how to deploy the Gem Match Wolf game to Azure.

## Azure Resources

### Resource Group
- **Name**: `gem-match-wolf-rg`
- **Location**: `westus2`
- **Subscription**: `b9167e1d-d52f-48fe-859d-65bc32b6c2f6`

### Service Principal
- **Display Name**: `gem-match-wolf-deploy`
- **Application (Client) ID**: `3b6f0d5d-2377-4081-a281-a7ba9569a73f`
- **Tenant ID**: `8aaad311-0a4e-4608-ab75-f8e756191ef7`
- **Role**: `Contributor` (scoped to gem-match-wolf-rg)

**Important**: The client secret was provided during creation and should be stored securely in your password manager or Azure Key Vault.

### Static Web App
- **Name**: `gem-match-wolf`
- **URL**: https://nice-sand-031cef01e.3.azurestaticapps.net
- **SKU**: Free
- **Location**: West US 2

### Storage Account
- **Name**: `gemmatchscores`
- **Location**: West US 2
- **SKU**: Standard_LRS (Locally Redundant Storage)
- **Purpose**: Stores high scores in Azure Table Storage
- **Table Name**: `highscores`

**Application Settings Configured:**
- `AZURE_STORAGE_CONNECTION_STRING`: Configured in Static Web App settings for API access

## GitHub Actions Setup

### Required Secrets

You need to add the following secret to your GitHub repository:

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add the following secret:

| Secret Name | Value |
|------------|-------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | `bf1fb627e643a8bd4890686b3f428b491a16af04ddf7dc3f07c9ec6583040f5e03-8f93b590-20f9-4c37-957a-507776b6552201e2431031cef01e` |

### Workflow Configuration

The GitHub Actions workflow is located at `.github/workflows/azure-static-web-apps-deploy.yml` and will:

1. **Trigger on**:
   - Push to `main` branch
   - Pull requests to `main` branch
   - Manual workflow dispatch

2. **Build Steps**:
   - Checkout code
   - Setup Node.js v22
   - Install dependencies (`npm ci`)
   - Build the project (`npm run build`)

3. **Deploy Steps**:
   - Deploy the built files from `bejeweled/dist` to Azure Static Web Apps

## Manual Deployment

If you need to deploy manually without GitHub Actions:

### Using Azure CLI

```bash
# Login to Azure
az login --tenant 8aaad311-0a4e-4608-ab75-f8e756191ef7

# Build the project
cd bejeweled
npm install
npm run build

# Deploy using the SWA CLI (install first: npm install -g @azure/static-web-apps-cli)
cd ..
swa deploy ./bejeweled/dist \
  --deployment-token bf1fb627e643a8bd4890686b3f428b491a16af04ddf7dc3f07c9ec6583040f5e03-8f93b590-20f9-4c37-957a-507776b6552201e2431031cef01e \
  --app-name gem-match-wolf
```

### Using Service Principal

If you need to use the service principal for other Azure operations:

```bash
# Login with service principal
az login --service-principal \
  --username 3b6f0d5d-2377-4081-a281-a7ba9569a73f \
  --password <CLIENT_SECRET> \
  --tenant 8aaad311-0a4e-4608-ab75-f8e756191ef7

# Now you can run az commands scoped to the gem-match-wolf-rg resource group
```

## Deployment Workflow

### Automatic Deployment

1. Commit your changes to a branch
2. Push to GitHub
3. Create a pull request to `main`
4. The workflow will create a staging environment for preview
5. Merge the PR to deploy to production
6. The game will be live at https://nice-sand-031cef01e.3.azurestaticapps.net

### Rollback

To rollback to a previous version:

1. Go to Azure Portal
2. Navigate to the Static Web App
3. Go to **Deployment history**
4. Select a previous successful deployment
5. Click **Activate**

## Monitoring & Logs

### View Deployment Logs

- **GitHub Actions**: Check the Actions tab in your GitHub repository
- **Azure Portal**: Go to Static Web App > Deployment History

### Application Logs

Static Web Apps don't have traditional application logs, but you can:
- Use Application Insights for custom telemetry
- Check browser console for client-side errors

## Custom Domain (Optional)

To add a custom domain:

1. Go to Azure Portal > Static Web App > Custom domains
2. Click **Add**
3. Enter your domain name
4. Follow the DNS configuration instructions
5. Azure will automatically provision an SSL certificate

## Troubleshooting

### Build Fails

Check the following:
- Node.js version is 22+ in the workflow
- All dependencies are in package.json
- Build script works locally: `cd bejeweled && npm run build`

### Deployment Fails

- Verify the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret is set correctly
- Check that the `app_location` path is correct in the workflow
- Ensure the build output is in `bejeweled/dist`

### Site Not Loading

- Wait 1-2 minutes after deployment completes
- Clear browser cache
- Check the deployment history in Azure Portal
- Verify the build produced output in the dist folder

## Security Best Practices

1. **Never commit secrets to source control**
   - Service principal credentials
   - Deployment tokens
   - API keys

2. **Rotate secrets regularly**
   - Service principal client secret: Every 6-12 months
   - Static Web Apps deployment token: As needed

3. **Use least privilege**
   - The service principal only has Contributor access to the resource group
   - Not subscription-wide access

4. **Monitor access**
   - Review Azure Active Directory sign-in logs
   - Check deployment history regularly

## Cost

The current setup uses:
- **Static Web Apps (Free tier)**: $0/month
  - 100 GB bandwidth per month
  - Custom domains included
  - Automatic SSL certificates

Note: If you exceed the free tier limits, you'll need to upgrade to the Standard tier ($9/month).

## Support & Resources

- [Azure Static Web Apps Documentation](https://docs.microsoft.com/en-us/azure/static-web-apps/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Azure CLI Reference](https://docs.microsoft.com/en-us/cli/azure/)
