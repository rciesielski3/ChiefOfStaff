# Workflow Configuration Guide

## Overview

The M4 workflows (persist-articles and export-latest-news) require environment variables to specify file paths and repository locations. This allows workflows to run on any system without modification.

## Required Environment Variables

### EXPORT_FILE_PATH
- **Purpose**: Path where exported articles JSON file is written
- **Used by**: `export-latest-news` workflow
- **Default**: `/app/latest.json` (fallback, should be overridden)
- **Example value**: `/qa-news/public/latest.json`
- **Description**: Path to the JSON file that will contain the exported news articles

### VAULT_PATH
- **Purpose**: Path to the vault/knowledge base directory
- **Used by**: Future workflows that require vault access
- **Example value**: `/Users/rafalciesielski/Developer/ChiefofStaff/vault`
- **Description**: Location of article vault or knowledge base storage

### PAIOS_REPO_PATH
- **Purpose**: Path to the PAIOS repository root
- **Used by**: Git operations in workflows
- **Example value**: `/qa-news` or `/app/qa-news`
- **Description**: Root directory of the qa-news repository for git operations

### PAIOS_REPO_URL
- **Purpose**: Git repository URL for cloning/updating
- **Used by**: Workflow setup and synchronization
- **Example value**: `https://github.com/yourorg/qa-news.git`
- **Description**: Remote git repository for the QA news project

## Setting Environment Variables in n8n

### Via n8n UI (Recommended for Production)

1. Open your n8n instance in a browser
2. Navigate to **Credentials** tab on the left sidebar
3. Locate and click on **Variables** section
4. Create new variables by clicking **Create new** button:

| Variable Name | Value |
|---|---|
| `EXPORT_FILE_PATH` | `/qa-news/public/latest.json` |
| `VAULT_PATH` | `/vault/articles` |
| `PAIOS_REPO_PATH` | `/qa-news` |
| `PAIOS_REPO_URL` | `https://github.com/yourorg/qa-news.git` |

5. Save each variable - n8n encrypts them securely

### Via Environment File (Development)

Create a `.env.local` file in your n8n project root:

```
EXPORT_FILE_PATH=/qa-news/public/latest.json
VAULT_PATH=/vault/articles
PAIOS_REPO_PATH=/qa-news
PAIOS_REPO_URL=https://github.com/yourorg/qa-news.git
```

Then restart n8n: `docker-compose restart n8n` (or equivalent for your n8n deployment)

### Via Docker Environment

If running n8n in Docker, pass environment variables at startup:

```bash
docker run -e EXPORT_FILE_PATH=/qa-news/public/latest.json \
           -e VAULT_PATH=/vault/articles \
           -e PAIOS_REPO_PATH=/qa-news \
           -e PAIOS_REPO_URL=https://github.com/yourorg/qa-news.git \
           n8n/n8n
```

## Testing Variable Injection

To verify that environment variables are correctly injected:

1. **In a Code node**, add debug logging:
   ```javascript
   return [
     {
       json: {
         EXPORT_FILE_PATH: process.env.EXPORT_FILE_PATH || '$env.EXPORT_FILE_PATH not set',
         VAULT_PATH: process.env.VAULT_PATH || '$env.VAULT_PATH not set',
         PAIOS_REPO_PATH: process.env.PAIOS_REPO_PATH || '$env.PAIOS_REPO_PATH not set'
       }
     }
   ];
   ```

2. **Run the workflow manually** and check the output

3. **Verify in logs**: The output should show actual paths, not variable placeholders

## Workflow-Specific Configuration

### export-latest-news

**Required variables:**
- `EXPORT_FILE_PATH`: Where to write the exported articles JSON

**Node: "Write latest.json (parameterized path)"**
- Uses `{{ $env.EXPORT_FILE_PATH || '/app/latest.json' }}` as file path
- Falls back to `/app/latest.json` if variable not set

**Node: "Git Commit Export"**
- Uses `{{ $env.PAIOS_REPO_PATH }}` in shell command
- Defaults to `/qa-news` if not configured

### persist-articles

**Required variables:**
- None (uses n8n Data Table, no file paths)

**Note:** Data Table operations use n8n's internal storage, not file system paths

### test-persist-export-pipeline

**Required variables:**
- `EXPORT_FILE_PATH`: Path for test export output

**Note:** Test workflow uses same parameterization as production workflows

## VPS Deployment Example

When deploying to VPS (e.g., OVH with free n8n), set variables based on your server layout:

```bash
# SSH into VPS
ssh user@vps.example.com

# In n8n credentials (via UI or .env):
export EXPORT_FILE_PATH=/home/n8n/app/qa-news/public/latest.json
export VAULT_PATH=/home/n8n/app/vault
export PAIOS_REPO_PATH=/home/n8n/app/qa-news
export PAIOS_REPO_URL=https://github.com/yourorg/qa-news.git

# Restart n8n
docker-compose restart n8n
```

## Troubleshooting

**Problem**: Workflow fails with "file not found" on export
- **Solution**: Check that `EXPORT_FILE_PATH` parent directory exists: `mkdir -p $(dirname $EXPORT_FILE_PATH)`

**Problem**: Variables show as `{{ $env.VARIABLE_NAME }}` in logs
- **Solution**: Variables not set in n8n. Add them via Credentials > Variables tab

**Problem**: Git commit fails in export workflow
- **Solution**: Verify `PAIOS_REPO_PATH` points to a valid git repository initialized with `.git/`

**Problem**: Different errors on VPS vs local
- **Solution**: Paths differ between environments. Check file permissions: `ls -la /path/to/file`

## Security Considerations

- **Do not** hardcode sensitive paths in workflow JSONs
- **Do** use environment variables for all file system operations
- **Encrypt** variable values in n8n's Credentials vault
- **Restrict** file system permissions: `chmod 700 /path/to/vault`
- **Audit** workflow access logs for unauthorized path changes

## Verification Checklist

Before deploying workflows to production:

- [ ] All file paths use `{{ $env.VARIABLE_NAME }}` syntax
- [ ] Environment variables are set in n8n UI or .env file
- [ ] Test workflow runs successfully
- [ ] Exported files appear at the correct path
- [ ] Git operations work (if applicable)
- [ ] File permissions allow n8n process to read/write
